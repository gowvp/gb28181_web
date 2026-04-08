import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CameraMarker, FloorWall, PlannerView } from "~/pages/desktop/floor_plan.types";
import { FLOOR_PLAN_WORLD_HEIGHT, FLOOR_PLAN_WORLD_WIDTH } from "~/pages/desktop/floor_plan.storage";

const MAP_W_DEFAULT = 168;
const MAP_H_DEFAULT = 105;
const MAP_W_COMPACT = 128;
const MAP_H_COMPACT = 80;
const DRAG_THRESHOLD_PX = 5;

type FloorPlanMinimapProps = {
  walls: FloorWall[];
  cameras: CameraMarker[];
  view: PlannerView;
  viewportWidth: number;
  viewportHeight: number;
  onCenterWorld: (worldX: number, worldY: number) => void;
  onPanViewByScreenDelta: (dx: number, dy: number) => void;
  /** 小屏缩小尺寸并上移，避免与底部提示条、安全区重叠 */
  compact?: boolean;
};

/**
 * 为什么小地图用 SVG + viewBox：
 * 墙线在世界坐标是任意斜线；SVG 与 Konva 世界系一致，便于点击/拖拽换算。
 * 为什么区分轻点与拖拽：
 * 轻点仍用于「跳到该大致区域」，拖拽用于连续平移主视口，两者手势不同，阈值避免误触。
 */
export function FloorPlanMinimap({
  walls,
  cameras,
  view,
  viewportWidth,
  viewportHeight,
  onCenterWorld,
  onPanViewByScreenDelta,
  compact = false,
}: FloorPlanMinimapProps) {
  const { t } = useTranslation("desktop");
  const [isDragging, setIsDragging] = useState(false);

  const MAP_W = compact ? MAP_W_COMPACT : MAP_W_DEFAULT;
  const MAP_H = compact ? MAP_H_COMPACT : MAP_H_DEFAULT;

  const worldW = FLOOR_PLAN_WORLD_WIDTH;
  const worldH = FLOOR_PLAN_WORLD_HEIGHT;

  const vpLeft = (-view.x) / view.scale;
  const vpTop = (-view.y) / view.scale;
  const vpW = viewportWidth / view.scale;
  const vpH = viewportHeight / view.scale;

  const sessionRef = useRef<{
    pointerId: number;
    lastClientX: number;
    lastClientY: number;
    startClientX: number;
    startClientY: number;
    startedDrag: boolean;
  } | null>(null);

  const clientToWorld = useCallback((clientX: number, clientY: number, svg: SVGSVGElement) => {
    const rect = svg.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    return { wx: nx * worldW, wy: ny * worldH };
  }, [worldW, worldH]);

  const endSession = useCallback((svg: SVGSVGElement, pointerId: number) => {
    try {
      svg.releasePointerCapture(pointerId);
    } catch {
      /* noop */
    }
    sessionRef.current = null;
    setIsDragging(false);
  }, []);

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.preventDefault();
    const svg = event.currentTarget;
    svg.setPointerCapture(event.pointerId);
    sessionRef.current = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startedDrag: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const session = sessionRef.current;
    if (!session || event.pointerId !== session.pointerId) {
      return;
    }
    const dx = event.clientX - session.lastClientX;
    const dy = event.clientY - session.lastClientY;
    const distFromStart = Math.hypot(
      event.clientX - session.startClientX,
      event.clientY - session.startClientY,
    );
    if (distFromStart > DRAG_THRESHOLD_PX) {
      if (!session.startedDrag) {
        session.startedDrag = true;
        setIsDragging(true);
      }
      onPanViewByScreenDelta(dx, dy);
      session.lastClientX = event.clientX;
      session.lastClientY = event.clientY;
    }
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const session = sessionRef.current;
    const svg = event.currentTarget;
    if (!session || event.pointerId !== session.pointerId) {
      return;
    }
    if (!session.startedDrag) {
      const { wx, wy } = clientToWorld(session.startClientX, session.startClientY, svg);
      onCenterWorld(wx, wy);
    }
    endSession(svg, event.pointerId);
  };

  return (
    <div
      className={`pointer-events-auto absolute left-4 z-30 flex flex-col gap-1 rounded-lg border border-gray-200 bg-white/95 p-1.5 shadow-md backdrop-blur ${
        compact ? "bottom-[max(6.5rem,env(safe-area-inset-bottom))]" : "bottom-24"
      }`}
      title={t("minimap_hint")}
    >
      <div className="text-[10px] font-medium text-gray-500">{t("minimap_title")}</div>
      <svg
        role="img"
        aria-label={t("minimap_title")}
        width={MAP_W}
        height={MAP_H}
        viewBox={`0 0 ${worldW} ${worldH}`}
        className={`rounded border border-gray-200 bg-slate-50 touch-none ${isDragging ? "cursor-grabbing" : "cursor-crosshair"}`}
        preserveAspectRatio="none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {walls.map((wall) => (
          <line
            key={wall.id}
            x1={wall.x1}
            y1={wall.y1}
            x2={wall.x2}
            y2={wall.y2}
            stroke="#94a3b8"
            strokeWidth={worldW / 200}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {cameras.map((camera) => (
          <circle
            key={camera.id}
            cx={camera.x}
            cy={camera.y}
            r={worldW / 160}
            fill="#3b82f6"
            stroke="#fff"
            strokeWidth={worldW / 400}
          />
        ))}
        <rect
          x={Math.max(0, vpLeft)}
          y={Math.max(0, vpTop)}
          width={Math.min(worldW, vpW)}
          height={Math.min(worldH, vpH)}
          fill="rgba(59,130,246,0.12)"
          stroke="#2563eb"
          strokeWidth={worldW / 200}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      </svg>
    </div>
  );
}
