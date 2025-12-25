import type { KonvaEventObject } from "konva/lib/Node";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Circle,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
} from "react-konva";
import useImage from "use-image";

export interface ZoneData {
  name: string;
  /** 归一化坐标数组 [x1, y1, x2, y2, ...] */
  points: number[];
  color: string;
  isFinished: boolean;
}

interface PolygonZoneEditorProps {
  /** 背景图片 URL，可为空 */
  imageUrl?: string;
  /** 初始区域数据 */
  initialZones?: ZoneData[];
  /** 当前选中的区域索引 */
  activeZoneIndex?: number;
  /** 是否处于编辑模式（可添加点） */
  isEditing?: boolean;
  /** 区域数据变更回调 */
  onZonesChange?: (zones: ZoneData[]) => void;
  /** 区域选中回调 */
  onZoneSelect?: (index: number | undefined) => void;
  /** 区域闭合回调 - 当绘制完成自动闭合时触发 */
  onZoneFinished?: (index: number) => void;
  /** 容器宽度 */
  width?: number;
  /** 容器高度 */
  height?: number;
}

/**
 * 多边形区域编辑器
 * 用于在监控画面截图上标记感兴趣区域 (ROI)
 * 参考 frigate 的交互设计：
 * - 点击添加进入编辑模式
 * - 点击画布添加点
 * - 点击第一个点闭合区域，自动退出编辑模式
 * - 闭合后可拖拽调整顶点位置
 */
export default function PolygonZoneEditor({
  imageUrl,
  initialZones = [],
  activeZoneIndex,
  isEditing = false,
  onZonesChange,
  onZoneSelect,
  onZoneFinished,
  width: containerWidth,
  height: containerHeight,
}: PolygonZoneEditorProps) {
  const { t } = useTranslation("common");
  const containerRef = useRef<HTMLDivElement>(null);
  const [image] = useImage(imageUrl || "", "anonymous");
  const [zones, setZones] = useState<ZoneData[]>(initialZones);
  const [dimensions, setDimensions] = useState({ width: 800, height: 450 });

  // 同步外部传入的 zones
  useEffect(() => {
    setZones(initialZones);
  }, [initialZones]);

  // 计算画布尺寸（保持图片宽高比，无图片时使用默认 16:9）
  useEffect(() => {
    const maxWidth = containerWidth || containerRef.current?.clientWidth || 800;
    const maxHeight = containerHeight || 600;

    if (image) {
      const imageRatio = image.width / image.height;
      let width = maxWidth;
      let height = width / imageRatio;

      if (height > maxHeight) {
        height = maxHeight;
        width = height * imageRatio;
      }
      setDimensions({ width, height });
    } else {
      // 无图片时使用 16:9 比例
      const ratio = 16 / 9;
      let width = maxWidth;
      let height = width / ratio;

      if (height > maxHeight) {
        height = maxHeight;
        width = height * ratio;
      }
      setDimensions({ width, height });
    }
  }, [image, containerWidth, containerHeight]);

  // 将归一化坐标转换为画布坐标
  const normalizedToCanvas = useCallback(
    (normalizedPoints: number[]): number[] => {
      const result: number[] = [];
      for (let i = 0; i < normalizedPoints.length; i += 2) {
        result.push(normalizedPoints[i] * dimensions.width);
        result.push(normalizedPoints[i + 1] * dimensions.height);
      }
      return result;
    },
    [dimensions],
  );

  // 点击画布添加点（仅在编辑模式下生效）
  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      // 如果不是编辑模式，不处理
      if (!isEditing) return;

      // 如果点击的是顶点（Circle），不处理（由 Circle 的 onClick 处理闭合）
      const clickedOnVertex = e.target.getClassName() === "Circle";
      if (clickedOnVertex) {
        return;
      }

      const stage = e.target.getStage();
      if (!stage) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      // 归一化坐标，限制最多 3 位小数
      const normX = Math.round((pos.x / dimensions.width) * 1000) / 1000;
      const normY = Math.round((pos.y / dimensions.height) * 1000) / 1000;

      // 如果有活动区域且未闭合，在该区域添加点
      if (activeZoneIndex !== undefined && zones[activeZoneIndex]) {
        const zone = zones[activeZoneIndex];
        if (!zone.isFinished) {
          const newZones = [...zones];
          newZones[activeZoneIndex] = {
            ...zone,
            points: [...zone.points, normX, normY],
          };
          setZones(newZones);
          onZonesChange?.(newZones);
        }
      }
    },
    [isEditing, activeZoneIndex, zones, dimensions, onZonesChange],
  );

  // 点击第一个点闭合多边形
  const handleFirstPointClick = useCallback(
    (zoneIndex: number) => {
      const zone = zones[zoneIndex];
      // 至少需要 3 个点才能闭合
      if (zone.points.length < 6) return;

      const newZones = [...zones];
      newZones[zoneIndex] = {
        ...zone,
        isFinished: true,
      };
      setZones(newZones);
      onZonesChange?.(newZones);
      // 通知父组件区域已闭合，退出编辑模式
      onZoneFinished?.(zoneIndex);
    },
    [zones, onZonesChange, onZoneFinished],
  );

  // 拖拽顶点（仅闭合后的区域可拖拽）
  const handleVertexDrag = useCallback(
    (zoneIndex: number, pointIndex: number, e: KonvaEventObject<DragEvent>) => {
      const pos = e.target.position();
      // 归一化坐标，限制最多 3 位小数，并限制在 0-1 范围内
      const normX =
        Math.round(Math.max(0, Math.min(1, pos.x / dimensions.width)) * 1000) /
        1000;
      const normY =
        Math.round(Math.max(0, Math.min(1, pos.y / dimensions.height)) * 1000) /
        1000;

      const newZones = [...zones];
      const zone = newZones[zoneIndex];
      const newPoints = [...zone.points];
      newPoints[pointIndex * 2] = normX;
      newPoints[pointIndex * 2 + 1] = normY;
      newZones[zoneIndex] = { ...zone, points: newPoints };
      setZones(newZones);
      onZonesChange?.(newZones);
    },
    [zones, dimensions, onZonesChange],
  );

  // 渲染多边形和顶点
  const renderZone = useCallback(
    (zone: ZoneData, zoneIndex: number) => {
      const canvasPoints = normalizedToCanvas(zone.points);
      const isActive = zoneIndex === activeZoneIndex;
      const pointCount = zone.points.length / 2;

      // 生成半透明填充色
      const fillColor = zone.isFinished ? `${zone.color}40` : "transparent";

      return (
        <React.Fragment key={zoneIndex}>
          {/* 多边形线条 */}
          <Line
            points={canvasPoints}
            stroke={zone.color}
            strokeWidth={isActive ? 3 : 2}
            closed={zone.isFinished}
            fill={fillColor}
            onClick={() => {
              if (!isEditing) {
                onZoneSelect?.(zoneIndex);
              }
            }}
            onTap={() => {
              if (!isEditing) {
                onZoneSelect?.(zoneIndex);
              }
            }}
          />

          {/* 顶点 - 仅在活动区域或闭合区域显示 */}
          {(isActive || zone.isFinished) &&
            Array.from({ length: pointCount }).map((_, i) => {
              const x = canvasPoints[i * 2];
              const y = canvasPoints[i * 2 + 1];
              const isFirstPoint = i === 0;
              const canClose =
                isFirstPoint &&
                !zone.isFinished &&
                pointCount >= 3 &&
                isEditing;

              return (
                <Circle
                  key={i}
                  x={x}
                  y={y}
                  radius={canClose ? 12 : 6}
                  fill={isFirstPoint && canClose ? "#ffffff" : zone.color}
                  stroke={zone.color}
                  strokeWidth={2}
                  draggable={zone.isFinished && isActive}
                  onClick={() => {
                    if (canClose) {
                      handleFirstPointClick(zoneIndex);
                    }
                  }}
                  onTap={() => {
                    if (canClose) {
                      handleFirstPointClick(zoneIndex);
                    }
                  }}
                  onDragEnd={(e) => handleVertexDrag(zoneIndex, i, e)}
                  style={{ cursor: canClose ? "pointer" : "move" }}
                />
              );
            })}
        </React.Fragment>
      );
    },
    [
      normalizedToCanvas,
      activeZoneIndex,
      isEditing,
      handleFirstPointClick,
      handleVertexDrag,
      onZoneSelect,
    ],
  );

  return (
    <div
      ref={containerRef}
      className="relative bg-gray-800 rounded-lg overflow-hidden"
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onClick={handleStageClick}
        onTap={handleStageClick}
        style={{ cursor: isEditing ? "crosshair" : "default" }}
      >
        <Layer>
          {/* 背景：图片或灰色占位 */}
          {image ? (
            <KonvaImage
              image={image}
              width={dimensions.width}
              height={dimensions.height}
            />
          ) : (
            <Rect
              width={dimensions.width}
              height={dimensions.height}
              fill="#374151"
            />
          )}

          {/* 渲染所有区域 */}
          {zones.map((zone, index) => renderZone(zone, index))}
        </Layer>
      </Stage>

      {/* 无图片时的提示文字 */}
      {!image && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-gray-400 text-sm">{t("no_image_available")}</p>
        </div>
      )}
    </div>
  );
}
