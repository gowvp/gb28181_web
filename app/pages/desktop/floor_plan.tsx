import type { KonvaEventObject } from "konva/lib/Node";
import { Button, Empty, Modal } from "antd";
import {
  Bell,
  Camera,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  Focus,
  Hand,
  Layers,
  LayoutTemplate,
  Map as MapIcon,
  MapPinned,
  MousePointer2,
  Pencil,
  Redo2,
  RotateCcw,
  ScanSearch,
  Square,
  Undo2,
  WandSparkles,
  Waypoints,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  Circle,
  Group,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
} from "react-konva";
import { useQuery } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { CameraBindingPanel } from "~/components/desktop/camera-binding-panel";
import { CameraHoverCard } from "~/components/desktop/camera-hover-card";
import { FloorPlanMinimap } from "~/components/desktop/floor-plan-minimap";
import {
  FindPlannerChannelOptions,
  findPlannerChannelOptionsKey,
} from "~/service/api/device/device";
import {
  FLOOR_PLAN_GRID_SIZE,
  FLOOR_PLAN_WORLD_HEIGHT,
  FLOOR_PLAN_WORLD_WIDTH,
  clearFloorPlanState,
  cloneFloorPlanState,
  createCameraMarker,
  createDefaultFloorPlanState,
  loadFloorPlanGuideDismissed,
  loadFloorPlanInteractionMode,
  loadFloorPlanState,
  normalizeFloorPlanState,
  saveFloorPlanGuideDismissed,
  saveFloorPlanInteractionMode,
  saveFloorPlanState,
  type FloorPlanInteractionMode,
} from "./floor_plan.storage";
import { clearLatestCameraEventCache, getLatestCameraEvent, prefetchLatestEventsForChannelIds } from "./floor_plan.events";
import { formatTimeAgoFromMs } from "./floor_plan.relative-time";
import { buildAlertsTo } from "./floor_plan.alerts";
import { buildPlaybackDetailTo } from "./floor_plan.playback";
import type {
  CameraMarker,
  FloorPlanState,
  FloorPlanTemplateId,
  FloorWall,
  LatestCameraEvent,
  PlannerPoint,
  PlannerSelection,
  PlannerTool,
  PlannerView,
} from "./floor_plan.types";

const ALIGNMENT_SNAP_THRESHOLD = FLOOR_PLAN_GRID_SIZE * 0.45;

/**
 * 为什么 Konva Stage 禁止 0 宽高：
 * react-konva 在虚线 Line 等场景会用内部 canvas 做纹理；Stage 为 0×0 时衍生 canvas 仍为 0，浏览器 drawImage 抛 InvalidStateError，整棵 FloorPlanEditor 被 ErrorBoundary 卸掉，hover 按钮随之失效。
 */
const KONVA_MIN_STAGE_SIZE = 1;

type SelectionDragSnapshot = {
  wallIds: string[];
  cameraIds: string[];
  startWorld: PlannerPoint;
  moved: boolean;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  wallOrigins: Record<string, FloorWall>;
  cameraOrigins: Record<string, { x: number; y: number }>;
};

type PlannerClipboardState = {
  walls: FloorWall[];
  cameras: CameraMarker[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  width: number;
  height: number;
};

type PlannerGuides = {
  vertical: number[];
  horizontal: number[];
};

/**
 * 为什么在编辑器内保留一份 clamp 而不从 storage 复用：
 * floor_plan 与持久化层解耦后不应反向依赖 storage 的私有工具，避免循环引用与 bundle 边界模糊；数值语义与 storage 一致即可。
 */
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * 为什么 id 要带时间戳与随机后缀：
 * 同一次交互里可能连续创建多条墙线，仅用自增或纯随机在并发/快速点击时仍有碰撞风险，混合时间戳能把冲突概率压到可接受且便于日志里按时间粗排。
 */
function createWallId() {
  return `wall-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 为什么摄像头 id 策略与墙线一致但前缀不同：
 * 日志与调试时按前缀过滤即可区分实体类型，避免把墙与摄像头误当作同一类对象排查。
 */
function createCameraId() {
  return `camera-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 为什么编组 id 单独前缀：
 * groupId 在墙与摄像头之间复用，若与实体 id 格式混用，撤销/复制时难以一眼看出是「标签」还是「可渲染对象」。
 */
function createGroupId() {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 为什么要先 filter(Boolean) 再 Set：
 * 合并选择或历史数据里可能出现空字符串 id，直接进入 Set 仍占坑位，后续 includes 判断会误判为「已选中」。
 */
function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

/**
 * 为什么空集合返回 null 而不是空对象：
 * 大量交互分支用「无选中」与「有选中」二分，null 能强制调用方显式处理，避免 wallIds/cameraIds 全空却当作有效选择集。
 */
function createSelection(wallIds: string[] = [], cameraIds: string[] = []): PlannerSelection {
  const walls = uniqueIds(wallIds);
  const cameras = uniqueIds(cameraIds);
  if (walls.length === 0 && cameras.length === 0) {
    return null;
  }
  return {
    wallIds: walls,
    cameraIds: cameras,
  };
}

/**
 * 为什么用统一计数而不是分别判断数组：
 * 批量操作（编组、删除、快捷键提示）只关心「选中了几个实体」，合并计数避免墙/摄像头两套重复逻辑漂移。
 */
function selectionCount(selection: PlannerSelection) {
  if (!selection) {
    return 0;
  }
  return selection.wallIds.length + selection.cameraIds.length;
}

/**
 * 为什么把墙与摄像头拆成 entityType 参数：
 * 两者 id 空间独立，若用单一字符串列表容易在复制粘贴后产生跨类型歧义；分类型查询让选中判断与后端 channel 概念解耦。
 */
function isEntitySelected(
  selection: PlannerSelection,
  entityType: "wall" | "camera",
  entityId: string,
) {
  if (!selection) {
    return false;
  }
  return entityType === "wall"
    ? selection.wallIds.includes(entityId)
    : selection.cameraIds.includes(entityId);
}

/**
 * 为什么 Ctrl/Cmd 多选要走 toggle 而不是覆盖：
 * 用户期望在已有选中集上增量加减，覆盖会打断框选后的精细调整，与常见矢量编辑习惯不一致。
 */
function toggleEntitySelection(
  selection: PlannerSelection,
  entityType: "wall" | "camera",
  entityId: string,
) {
  if (entityType === "wall") {
    const next = selection?.wallIds.includes(entityId)
      ? (selection?.wallIds ?? []).filter((id) => id !== entityId)
      : [...(selection?.wallIds ?? []), entityId];
    return createSelection(next, selection?.cameraIds ?? []);
  }

  const next = selection?.cameraIds.includes(entityId)
    ? (selection?.cameraIds ?? []).filter((id) => id !== entityId)
    : [...(selection?.cameraIds ?? []), entityId];
  return createSelection(selection?.wallIds ?? [], next);
}

/**
 * 为什么编组查询要落在 plan 上而不是缓存 groupId：
 * groupId 存在实体上，plan 是唯一事实来源；单独维护映射会在撤销/重做时与 plan 分叉。
 */
function getEntityGroupId(
  plan: FloorPlanState,
  entityType: "wall" | "camera",
  entityId: string,
) {
  if (entityType === "wall") {
    return plan.walls.find((wall) => wall.id === entityId)?.groupId ?? null;
  }
  return plan.cameras.find((camera) => camera.id === entityId)?.groupId ?? null;
}

/**
 * 为什么点击单个对象要展开整组：
 * 编组的意义是「一起动」，若只高亮其中一个，用户会误以为未编组成功，展开整组能减少反复确认的成本。
 */
function selectEntity(plan: FloorPlanState, entityType: "wall" | "camera", entityId: string) {
  const groupId = getEntityGroupId(plan, entityType, entityId);
  if (!groupId) {
    return entityType === "wall"
      ? createSelection([entityId], [])
      : createSelection([], [entityId]);
  }

  return createSelection(
    plan.walls.filter((wall) => wall.groupId === groupId).map((wall) => wall.id),
    plan.cameras.filter((camera) => camera.groupId === groupId).map((camera) => camera.id),
  );
}

/**
 * 为什么解组需要收集当前选区涉及的所有 groupId：
 * 一次多选可能跨多个编组，解组要对每个组分别清空 groupId，只处理第一个会留下「半解组」的隐蔽状态。
 */
function getSelectionGroupIds(plan: FloorPlanState, selection: PlannerSelection) {
  if (!selection) {
    return [] as string[];
  }

  const ids = [
    ...plan.walls
      .filter((wall) => selection.wallIds.includes(wall.id) && wall.groupId)
      .map((wall) => wall.groupId as string),
    ...plan.cameras
      .filter((camera) => selection.cameraIds.includes(camera.id) && camera.groupId)
      .map((camera) => camera.groupId as string),
  ];

  return uniqueIds(ids);
}

/**
 * 为什么坐标要吸附网格而不是任意浮点：
 * 产品约定首版以网格为「可沟通」的精度，自由浮点会让对齐线与用户口述坐标都对不上，吸附后墙线与摄像头更容易一致复现。
 */
function snapPoint(point: PlannerPoint): PlannerPoint {
  return {
    x: Math.round(point.x / FLOOR_PLAN_GRID_SIZE) * FLOOR_PLAN_GRID_SIZE,
    y: Math.round(point.y / FLOOR_PLAN_GRID_SIZE) * FLOOR_PLAN_GRID_SIZE,
  };
}

/**
 * 为什么世界坐标要裁剪到固定矩形：
 * 无限坐标会让缩放适配与碰撞检测溢出，裁剪后保证所有实体落在可持久化、可预览的同一画布语义内。
 */
function clampPointToWorld(point: PlannerPoint): PlannerPoint {
  return {
    x: clamp(point.x, 0, FLOOR_PLAN_WORLD_WIDTH),
    y: clamp(point.y, 0, FLOOR_PLAN_WORLD_HEIGHT),
  };
}

/**
 * 为什么用容器 getBoundingClientRect 而不是 Stage 内置坐标：
 * 工具栏与侧栏占用空间时，指针事件相对视口的偏移必须扣掉容器原点，否则缩放/平移后的世界坐标会系统性偏移。
 */
function clientToWorld(
  clientX: number,
  clientY: number,
  container: HTMLDivElement,
  view: PlannerView,
): PlannerPoint {
  const rect = container.getBoundingClientRect();
  return {
    x: (clientX - rect.left - view.x) / view.scale,
    y: (clientY - rect.top - view.y) / view.scale,
  };
}

/**
 * 为什么需要 worldToScreen：
 * HTML 悬浮层（如 AI 事件卡片）不在 Konva 坐标系内渲染，必须把同一世界点转换到屏幕像素才能与摄像头圆点对齐。
 */
function worldToScreen(point: PlannerPoint, view: PlannerView): PlannerPoint {
  return {
    x: point.x * view.scale + view.x,
    y: point.y * view.scale + view.y,
  };
}

/**
 * 为什么缩放要以指针下世界坐标为锚点：
 * 若只改 scale 不改 x/y，视口会向一角漂移，用户会以为「缩放中心不对」；保持光标下一点钉在地上是地图类交互的默认预期。
 */
function zoomViewAtScreenPoint(
  plan: FloorPlanState,
  screenX: number,
  screenY: number,
  factor: number,
): FloorPlanState {
  const { view } = plan;
  const worldX = (screenX - view.x) / view.scale;
  const worldY = (screenY - view.y) / view.scale;
  const newScale = clamp(view.scale * factor, 0.35, 3.2);
  return {
    ...plan,
    view: {
      scale: newScale,
      x: screenX - worldX * newScale,
      y: screenY - worldY * newScale,
    },
  };
}

/**
 * 为什么角度展示要取整：
 * 浮点角度在 UI 上无业务意义却增加噪音，取整与滑杆步进心智一致，也避免国际化字符串过长。
 */
function formatAngle(angle: number) {
  return `${Math.round(angle)}°`;
}

/**
 * 为什么扇形用分段折线近似：
 * Konva 无原生扇形图元，用多边形逼近可在任意 FOV 下保持闭合填充；步数随 FOV 变化避免宽角时边缘过糙。
 */
function createSectorPoints(camera: CameraMarker) {
  const steps = Math.max(8, Math.ceil(camera.fov / 10));
  const startAngle = camera.angle - camera.fov / 2;
  const endAngle = camera.angle + camera.fov / 2;
  const points = [camera.x, camera.y];

  for (let index = 0; index <= steps; index += 1) {
    const angle = startAngle + ((endAngle - startAngle) * index) / steps;
    const radians = (angle * Math.PI) / 180;
    points.push(
      camera.x + Math.cos(radians) * camera.range,
      camera.y + Math.sin(radians) * camera.range,
    );
  }

  return points;
}

/**
 * 为什么空平面图要给非零默认包围盒：
 * 「适配画布」在无任何实体时需要可计算的缩放中心，否则会得到 NaN 或极端缩放，用户误以为视图坏了。
 */
function getPlanBounds(plan: FloorPlanState) {
  const points: PlannerPoint[] = [];

  for (const wall of plan.walls) {
    points.push({ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 });
  }

  for (const camera of plan.cameras) {
    points.push({ x: camera.x, y: camera.y });
  }

  if (points.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: FLOOR_PLAN_WORLD_WIDTH * 0.45,
      maxY: FLOOR_PLAN_WORLD_HEIGHT * 0.45,
    };
  }

  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

/**
 * 为什么摄像头单独算包围盒：
 * 「只看机位」的适配不应被远处墙线拉大视野，否则用户放大找探头时一键适配又回到全图，违背「聚焦绑定通道」的运维路径。
 */
function getCamerasBounds(cameras: CameraMarker[]) {
  if (cameras.length === 0) {
    return null;
  }
  const xs = cameras.map((camera) => camera.x);
  const ys = cameras.map((camera) => camera.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/**
 * 为什么选中包围盒与全图包围盒分开：
 * Alt 复制等操作只需在当前选中范围内算偏移，混入未选墙线会让粘贴落点偏离用户视觉焦点。
 */
function getSelectionBounds(plan: FloorPlanState, selection: PlannerSelection) {
  if (!selection) {
    return null;
  }

  const xValues = [
    ...plan.walls
      .filter((wall) => selection.wallIds.includes(wall.id))
      .flatMap((wall) => [wall.x1, wall.x2]),
    ...plan.cameras
      .filter((camera) => selection.cameraIds.includes(camera.id))
      .map((camera) => camera.x),
  ];
  const yValues = [
    ...plan.walls
      .filter((wall) => selection.wallIds.includes(wall.id))
      .flatMap((wall) => [wall.y1, wall.y2]),
    ...plan.cameras
      .filter((camera) => selection.cameraIds.includes(camera.id))
      .map((camera) => camera.y),
  ];

  if (xValues.length === 0 || yValues.length === 0) {
    return null;
  }

  return {
    minX: Math.min(...xValues),
    maxX: Math.max(...xValues),
    minY: Math.min(...yValues),
    maxY: Math.max(...yValues),
  };
}

/**
 * 为什么剪贴板要存边界与宽高：
 * 粘贴时需要把内容整体平移且不越界，边界与尺寸来自选中集本身，比每次从 plan 重算更稳定且与撤销栈快照一致。
 */
function buildClipboard(plan: FloorPlanState, selection: PlannerSelection): PlannerClipboardState | null {
  if (!selection) {
    return null;
  }

  const walls = plan.walls.filter((wall) => selection.wallIds.includes(wall.id));
  const cameras = plan.cameras.filter((camera) => selection.cameraIds.includes(camera.id));
  if (walls.length === 0 && cameras.length === 0) {
    return null;
  }

  const bounds = getSelectionBounds(plan, selection);
  if (!bounds) {
    return null;
  }

  return {
    walls: walls.map((wall) => ({ ...wall })),
    cameras: cameras.map((camera) => ({ ...camera })),
    bounds,
    width: Math.max(FLOOR_PLAN_GRID_SIZE, bounds.maxX - bounds.minX),
    height: Math.max(FLOOR_PLAN_GRID_SIZE, bounds.maxY - bounds.minY),
  };
}

/**
 * 为什么粘贴时要 remap groupId：
 * 新墙线与摄像头是全新 id，若沿用旧 groupId 会与未粘贴对象意外同组；按旧组映射到新 id 才能保持「副本内部」仍为一组。
 */
function createPastedEntities(clipboard: PlannerClipboardState, targetTopLeft: PlannerPoint) {
  const deltaX = targetTopLeft.x - clipboard.bounds.minX;
  const deltaY = targetTopLeft.y - clipboard.bounds.minY;
  const groupIdMap = new Map<string, string>();
  const mapGroupId = (groupId?: string | null) => {
    if (!groupId) {
      return null;
    }
    if (!groupIdMap.has(groupId)) {
      groupIdMap.set(groupId, createGroupId());
    }
    return groupIdMap.get(groupId) ?? null;
  };

  const walls = clipboard.walls.map((wall) => ({
    ...wall,
    id: createWallId(),
    x1: wall.x1 + deltaX,
    y1: wall.y1 + deltaY,
    x2: wall.x2 + deltaX,
    y2: wall.y2 + deltaY,
    groupId: mapGroupId(wall.groupId),
  }));

  const cameras = clipboard.cameras.map((camera) => ({
    ...camera,
    id: createCameraId(),
    x: camera.x + deltaX,
    y: camera.y + deltaY,
    groupId: mapGroupId(camera.groupId),
  }));

  return { walls, cameras };
}

/**
 * 为什么粘贴锚点要先 clamp 再 snap：
 * 先限制在世界矩形内避免半截墙线出界，再吸附网格与手动放置摄像头规则一致，减少「贴进来却看不见」的困惑。
 */
function clampPasteTopLeft(point: PlannerPoint, clipboard: PlannerClipboardState) {
  return snapPoint({
    x: clamp(point.x, 0, Math.max(0, FLOOR_PLAN_WORLD_WIDTH - clipboard.width)),
    y: clamp(point.y, 0, Math.max(0, FLOOR_PLAN_WORLD_HEIGHT - clipboard.height)),
  });
}

/**
 * 为什么原地复制要生成新 id 却仍放在原 bounds：
 * Alt 拖动复制的交互是「先有一份重叠再拖开」，若直接偏移会改变用户鼠标下的命中点，与常见设计软件行为不一致。
 */
function duplicateSelectionAtSource(plan: FloorPlanState, selection: PlannerSelection) {
  const clipboard = buildClipboard(plan, selection);
  if (!clipboard) {
    return null;
  }

  const pasted = createPastedEntities(clipboard, {
    x: clipboard.bounds.minX,
    y: clipboard.bounds.minY,
  });

  return {
    clipboard,
    pasted,
    selection: createSelection(
      pasted.walls.map((wall) => wall.id),
      pasted.cameras.map((camera) => camera.id),
    ),
  };
}

/**
 * 为什么对齐参考要排除当前拖动选区：
 * 若把正在移动的点当参考，辅助线会与自己吸附，失去「对齐到其它物体」的意义。
 */
function getGuideReferenceValues(plan: FloorPlanState, excludedSelection?: PlannerSelection) {
  const xValues = [0, FLOOR_PLAN_WORLD_WIDTH / 2, FLOOR_PLAN_WORLD_WIDTH];
  const yValues = [0, FLOOR_PLAN_WORLD_HEIGHT / 2, FLOOR_PLAN_WORLD_HEIGHT];

  for (const wall of plan.walls) {
    if (excludedSelection?.wallIds.includes(wall.id)) {
      continue;
    }
    xValues.push(wall.x1, wall.x2);
    yValues.push(wall.y1, wall.y2);
  }

  for (const camera of plan.cameras) {
    if (excludedSelection?.cameraIds.includes(camera.id)) {
      continue;
    }
    xValues.push(camera.x);
    yValues.push(camera.y);
  }

  return {
    xValues: Array.from(new Set(xValues.map((value) => Math.round(value)))),
    yValues: Array.from(new Set(yValues.map((value) => Math.round(value)))),
  };
}

/**
 * 为什么拖动时还要单独从 snapshot 取参考值：
 * 拖动过程中 plan 已被改写，用 snapshot 里的原始坐标才能计算「相对起点」的位移，避免累积误差。
 */
function getSnapshotGuideValues(snapshot: SelectionDragSnapshot) {
  const xValues = [
    ...Object.values(snapshot.wallOrigins).flatMap((wall) => [wall.x1, wall.x2]),
    ...Object.values(snapshot.cameraOrigins).map((camera) => camera.x),
  ];
  const yValues = [
    ...Object.values(snapshot.wallOrigins).flatMap((wall) => [wall.y1, wall.y2]),
    ...Object.values(snapshot.cameraOrigins).map((camera) => camera.y),
  ];

  return {
    xValues: Array.from(new Set(xValues.map((value) => Math.round(value)))),
    yValues: Array.from(new Set(yValues.map((value) => Math.round(value)))),
  };
}

/**
 * 为什么在阈值内选最小 delta：
 * 多参考线可能同时满足吸附，取最近的一条避免在两个等距参考之间抖动。
 */
function findGuideAdjustment(movingValues: number[], referenceValues: number[]) {
  let bestDelta: number | null = null;
  let guide: number | null = null;

  for (const movingValue of movingValues) {
    for (const referenceValue of referenceValues) {
      const delta = referenceValue - movingValue;
      if (Math.abs(delta) > ALIGNMENT_SNAP_THRESHOLD) {
        continue;
      }
      if (bestDelta === null || Math.abs(delta) < Math.abs(bestDelta)) {
        bestDelta = delta;
        guide = referenceValue;
      }
    }
  }

  return {
    delta: bestDelta ?? 0,
    guide,
  };
}

/**
 * 为什么 Shift 锁轴向时比较 |dx| 与 |dy|：
 * 用户意图是「更像横线还是竖线」，取绝对值大的一侧决定锁定方向，比固定先横后竖更符合手绘习惯。
 */
function snapWallEnd(start: PlannerPoint, point: PlannerPoint) {
  const deltaX = point.x - start.x;
  const deltaY = point.y - start.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return { x: point.x, y: start.y };
  }

  return { x: start.x, y: point.y };
}

/**
 * 为什么矩形规范化要交换 min/max：
 * 拖拽方向任意时 start/end 可能颠倒，不规范化会出现负宽高，后续 Konva Rect 与碰撞检测都会异常。
 */
function normalizeRect(start: PlannerPoint, end: PlannerPoint) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x),
    height: Math.abs(start.y - end.y),
  };
}

/**
 * 为什么框选矩形要附带 x2/y2：
 * 线段与矩形相交判断需要闭区间边界，重复用 width/height 相加会散落多处计算，容易与 normalizeRect 不一致。
 */
function normalizeMarqueeRect(start: PlannerPoint, end: PlannerPoint) {
  const rect = normalizeRect(start, end);
  return {
    ...rect,
    x2: rect.x + rect.width,
    y2: rect.y + rect.height,
  };
}

/**
 * 为什么点入矩形用闭区间：
 * 与线段相交的边界情况一致，避免贴边点被排除导致「明明框住了却选不中」。
 */
function pointInRect(point: PlannerPoint, rect: ReturnType<typeof normalizeMarqueeRect>) {
  return point.x >= rect.x && point.x <= rect.x2 && point.y >= rect.y && point.y <= rect.y2;
}

/**
 * 为什么框选墙线用线段相交判断而不是只看端点：
 * 长线段可能完全穿过框选区但两端都在外，仅测端点会漏选，用户会认为框选不可靠。
 */
function lineSegmentsIntersect(a: PlannerPoint, b: PlannerPoint, c: PlannerPoint, d: PlannerPoint) {
  const direction = (p1: PlannerPoint, p2: PlannerPoint, p3: PlannerPoint) =>
    (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
  const onSegment = (p1: PlannerPoint, p2: PlannerPoint, p3: PlannerPoint) =>
    Math.min(p1.x, p2.x) <= p3.x &&
    p3.x <= Math.max(p1.x, p2.x) &&
    Math.min(p1.y, p2.y) <= p3.y &&
    p3.y <= Math.max(p1.y, p2.y);

  const d1 = direction(c, d, a);
  const d2 = direction(c, d, b);
  const d3 = direction(a, b, c);
  const d4 = direction(a, b, d);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  if (d1 === 0 && onSegment(c, d, a)) {
    return true;
  }
  if (d2 === 0 && onSegment(c, d, b)) {
    return true;
  }
  if (d3 === 0 && onSegment(a, b, c)) {
    return true;
  }
  if (d4 === 0 && onSegment(a, b, d)) {
    return true;
  }

  return false;
}

/**
 * 为什么线段与矩形相交要先做快速排斥：
 * 全量与四条边做相交计算较贵，先与轴对齐包围盒排除大量无关线段，大图元数时更稳。
 */
function lineIntersectsRect(
  start: PlannerPoint,
  end: PlannerPoint,
  rect: ReturnType<typeof normalizeMarqueeRect>,
) {
  if (pointInRect(start, rect) || pointInRect(end, rect)) {
    return true;
  }

  if (
    Math.max(start.x, end.x) < rect.x ||
    Math.min(start.x, end.x) > rect.x2 ||
    Math.max(start.y, end.y) < rect.y ||
    Math.min(start.y, end.y) > rect.y2
  ) {
    return false;
  }

  const topLeft = { x: rect.x, y: rect.y };
  const topRight = { x: rect.x2, y: rect.y };
  const bottomRight = { x: rect.x2, y: rect.y2 };
  const bottomLeft = { x: rect.x, y: rect.y2 };

  return [
    [topLeft, topRight],
    [topRight, bottomRight],
    [bottomRight, bottomLeft],
    [bottomLeft, topLeft],
  ].some(([edgeStart, edgeEnd]) => lineSegmentsIntersect(start, end, edgeStart, edgeEnd));
}

/**
 * 为什么过小的框选视为无效：
 * 误触点击会产生极小矩形，若仍触发选择会清空用户当前 carefully 选中的集合，最小尺寸阈值把点击与框选区分开。
 */
function selectionFromRect(plan: FloorPlanState, start: PlannerPoint, end: PlannerPoint) {
  const rect = normalizeMarqueeRect(start, end);
  if (rect.width < 6 && rect.height < 6) {
    return null;
  }

  return createSelection(
    plan.walls
      .filter((wall) =>
        lineIntersectsRect(
          { x: wall.x1, y: wall.y1 },
          { x: wall.x2, y: wall.y2 },
          rect,
        ),
      )
      .map((wall) => wall.id),
    plan.cameras
      .filter((camera) => pointInRect({ x: camera.x, y: camera.y }, rect))
      .map((camera) => camera.id),
  );
}

/**
 * 为什么追加框选要合并两个 selection 再 unique：
 * Ctrl 框选追加时，新矩形选出的 id 需与旧集合并集，直接替换会丢失上一轮选中。
 */
function mergeSelections(base: PlannerSelection, addition: PlannerSelection) {
  return createSelection(
    [...(base?.wallIds ?? []), ...(addition?.wallIds ?? [])],
    [...(base?.cameraIds ?? []), ...(addition?.cameraIds ?? [])],
  );
}

/**
 * 为什么 Shift 拖动时只保留主轴位移：
 * 与墙线 Shift 锁轴向一致，批量移动多选对象时用户可沿走廊方向平移而不跑偏。
 */
function constrainDragDelta(deltaX: number, deltaY: number, constrained: boolean) {
  if (!constrained) {
    return { deltaX, deltaY };
  }

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return { deltaX, deltaY: 0 };
  }

  return { deltaX: 0, deltaY };
}

/**
 * 为什么矩形房间有最小宽高阈值：
 * 与误触点击区分，同时避免生成过短墙线导致端点手柄重叠难以编辑。
 */
function createRectangleWalls(start: PlannerPoint, end: PlannerPoint) {
  const rect = normalizeRect(start, end);
  if (rect.width < FLOOR_PLAN_GRID_SIZE || rect.height < FLOOR_PLAN_GRID_SIZE) {
    return [];
  }

  const topLeft = { x: rect.x, y: rect.y };
  const topRight = { x: rect.x + rect.width, y: rect.y };
  const bottomRight = { x: rect.x + rect.width, y: rect.y + rect.height };
  const bottomLeft = { x: rect.x, y: rect.y + rect.height };

  return createPolygonWalls([topLeft, topRight, bottomRight, bottomLeft]);
}

/**
 * 为什么多边形墙用首尾闭合：
 * 房间轮廓是封闭区域，最后一条边连回起点才能形成可填充的语义闭环，与预设模板一致。
 */
function createPolygonWalls(points: PlannerPoint[]) {
  if (points.length < 2) {
    return [] as FloorWall[];
  }

  const walls: FloorWall[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    walls.push({
      id: createWallId(),
      x1: current.x,
      y1: current.y,
      x2: next.x,
      y2: next.y,
      groupId: null,
    });
  }

  return walls;
}

/**
 * 为什么预设轮廓要相对 center 平移再裁剪：
 * 模板定义在局部坐标系，插入到用户当前视口中心才能「一眼看到」；裁剪保证整段轮廓在可编辑世界内。
 */
function createPresetWalls(templateId: FloorPlanTemplateId, center: PlannerPoint) {
  const shape: PlannerPoint[] = (() => {
    switch (templateId) {
      case "small_room":
        return [
          { x: 0, y: 0 },
          { x: 400, y: 0 },
          { x: 400, y: 280 },
          { x: 0, y: 280 },
        ];
      case "corridor":
        return [
          { x: 0, y: 0 },
          { x: 760, y: 0 },
          { x: 760, y: 160 },
          { x: 0, y: 160 },
        ];
      case "l_room":
        return [
          { x: 0, y: 0 },
          { x: 520, y: 0 },
          { x: 520, y: 160 },
          { x: 280, y: 160 },
          { x: 280, y: 400 },
          { x: 0, y: 400 },
        ];
      default:
        return [];
    }
  })();

  if (shape.length === 0) {
    return [] as FloorWall[];
  }

  const bounds = {
    minX: Math.min(...shape.map((point) => point.x)),
    minY: Math.min(...shape.map((point) => point.y)),
    maxX: Math.max(...shape.map((point) => point.x)),
    maxY: Math.max(...shape.map((point) => point.y)),
  };

  const offsetX = center.x - (bounds.minX + bounds.maxX) / 2;
  const offsetY = center.y - (bounds.minY + bounds.maxY) / 2;

  return createPolygonWalls(
    shape.map((point) =>
      clampPointToWorld(
        snapPoint({ x: point.x + offsetX, y: point.y + offsetY }),
      ),
    ),
  );
}

/**
 * 为什么视口中心要逆变换到世界坐标：
 * 预设与「点击放置」共享同一世界系，只有把屏幕中心换算回去，插入位置才与缩放/平移状态无关。
 */
function getViewportCenter(view: PlannerView, viewport: { width: number; height: number }) {
  return snapPoint({
    x: (viewport.width / 2 - view.x) / view.scale,
    y: (viewport.height / 2 - view.y) / view.scale,
  });
}

/**
 * 为什么底部提示条随工具切换：
 * 平面图能力多，用户容易忘记当前模式；短句提示把「此刻能做什么」绑在工具上，降低反复试错的成本。
 */
function toolHint(tool: PlannerTool, t: (key: string) => string) {
  switch (tool) {
    case "select":
      return t("select_hint_v2");
    case "wall":
      return t("wall_drag_hint");
    case "room":
      return t("room_drag_hint");
    case "camera":
      return t("camera_place_hint");
    case "pan":
      return t("pan_hint_v2");
    default:
      return "";
  }
}

/**
 * 为什么工具栏按钮用原生 title 而不是复杂 Tooltip：
 * 平面图顶部空间紧凑，hover 即显的浏览器 tooltip 不额外占布局，且避免与 Konva 画布事件竞争。
 */
function ToolbarButton({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-300"
            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * 为什么复制/粘贴等操作用小号文字按钮：
 * 与图标工具区分层级，避免所有功能都是方块图标导致扫视困难；禁用态仍占位，快捷键提示才能对齐。
 */
function CompactActionButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center rounded-lg border px-3 text-xs font-semibold transition-colors ${
        disabled
          ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-300"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * 为什么预设单独组件而不是内联 onClick：
 * 右侧多块预设共用同一样式，抽组件避免改圆角/间距时漏改某一格，也便于以后加缩略预览。
 */
function PresetButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
        disabled
          ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

interface FloorPlanEditorProps {
  viewMode: "dataflow" | "2d";
  onViewModeChange: (mode: "dataflow" | "2d") => void;
}

/**
 * 为什么 2D 编辑器自包含顶栏切换而不复用 ReactFlow 的 Panel：
 * 2D 模式全屏占用时若仍依赖父级 Panel，切换入口会随数据流卸载而消失；自顶栏保证在纯画布状态下仍能回到拓扑视图。
 */
export default function FloorPlanEditor({ onViewModeChange }: FloorPlanEditorProps) {
  const { t } = useTranslation("desktop");
  const initialPlan = useMemo(
    () => loadFloorPlanState() ?? createDefaultFloorPlanState(),
    [],
  );

  const [plan, setPlan] = useState<FloorPlanState>(initialPlan);
  const planRef = useRef<FloorPlanState>(initialPlan);
  const [tool, setTool] = useState<PlannerTool>("select");
  const [selection, setSelection] = useState<PlannerSelection>(null);
  const selectionRef = useRef<PlannerSelection>(null);
  const [wallPreview, setWallPreview] = useState<{
    start: PlannerPoint;
    end: PlannerPoint;
  } | null>(null);
  const [roomPreview, setRoomPreview] = useState<{
    start: PlannerPoint;
    end: PlannerPoint;
  } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 800 });
  const [historyVersion, setHistoryVersion] = useState(0);
  const [hoveredCameraId, setHoveredCameraId] = useState<string | null>(null);
  const [hoverEvent, setHoverEvent] = useState<LatestCameraEvent | null>(null);
  const [hoverLoading, setHoverLoading] = useState(false);
  const [interactionMode, setInteractionMode] = useState<FloorPlanInteractionMode>(() =>
    loadFloorPlanInteractionMode(),
  );
  const interactionModeRef = useRef(interactionMode);
  const [channelNameFilter, setChannelNameFilter] = useState("");
  const [filterMatchIndex, setFilterMatchIndex] = useState(0);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [panelLatestEvent, setPanelLatestEvent] = useState<LatestCameraEvent | null>(null);
  const [panelEventLoading, setPanelEventLoading] = useState(false);
  const [panelEventFetchedAt, setPanelEventFetchedAt] = useState<number | null>(null);
  const [panelEventRefreshToken, setPanelEventRefreshToken] = useState(0);
  const [hoverEventFetchedAt, setHoverEventFetchedAt] = useState<number | null>(null);
  const [relativeTimeTick, setRelativeTimeTick] = useState(0);
  const [hasClipboard, setHasClipboard] = useState(false);
  const [alignmentGuides, setAlignmentGuides] = useState<PlannerGuides>({
    vertical: [],
    horizontal: [],
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const hoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<FloorPlanState[]>([cloneFloorPlanState(initialPlan)]);
  const historyIndexRef = useRef(0);
  const clipboardRef = useRef<PlannerClipboardState | null>(null);
  const pasteCascadeRef = useRef(0);
  const pointerWorldRef = useRef<PlannerPoint | null>(null);
  const panRef = useRef<
    | {
        startX: number;
        startY: number;
        originX: number;
        originY: number;
      }
    | null
  >(null);
  const wallDrawRef = useRef<{ start: PlannerPoint } | null>(null);
  const roomDrawRef = useRef<{ start: PlannerPoint } | null>(null);
  const marqueeRef = useRef<
    | {
        start: PlannerPoint;
        current: PlannerPoint;
        additive: boolean;
      }
    | null
  >(null);
  const dragSelectionRef = useRef<SelectionDragSnapshot | null>(null);
  const dragWallHandleRef = useRef<
    | {
        wallId: string;
        endpoint: "start" | "end";
        moved: boolean;
        anchor: PlannerPoint;
      }
    | null
  >(null);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);

  useEffect(() => {
    planRef.current = plan;
    saveFloorPlanState(plan);
  }, [plan]);

  useEffect(() => {
    return () => {
      if (hoverLeaveTimerRef.current) {
        clearTimeout(hoverLeaveTimerRef.current);
      }
    };
  }, []);

  const cancelHoverClear = useCallback(() => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
  }, []);

  /**
   * 为什么离开摄像头要延时再清 hover：
   * 卡片通过 Portal 画在 body 上，指针从圆点移到按钮必经「画布外」间隙，会立刻触发 Group onMouseLeave；短延时让用户有时间移入卡片，否则链接永远点不到。
   */
  const scheduleHoverClear = useCallback(() => {
    cancelHoverClear();
    hoverLeaveTimerRef.current = setTimeout(() => {
      hoverLeaveTimerRef.current = null;
      setHoveredCameraId(null);
      setHoverEvent(null);
      setHoverLoading(false);
    }, 220);
  }, [cancelHoverClear]);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    interactionModeRef.current = interactionMode;
    saveFloorPlanInteractionMode(interactionMode);
  }, [interactionMode]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) {
        return;
      }
      const width = Math.max(KONVA_MIN_STAGE_SIZE, Math.floor(rect.width));
      const height = Math.max(KONVA_MIN_STAGE_SIZE, Math.floor(rect.height));
      setViewportSize({ width, height });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /**
   * 为什么首帧再量一次 clientWidth/Height：
   * flex 子项在首 paint 前 contentRect 可能为 0，仅依赖 ResizeObserver 会留下 0×0 一帧；layout 后同步测量可避免 Konva 首次 mount 就崩。
   */
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const width = Math.max(KONVA_MIN_STAGE_SIZE, Math.floor(element.clientWidth));
    const height = Math.max(KONVA_MIN_STAGE_SIZE, Math.floor(element.clientHeight));
    setViewportSize((previous) =>
      previous.width === width && previous.height === height ? previous : { width, height },
    );
  }, []);

  const channelQuery = useQuery({
    queryKey: [findPlannerChannelOptionsKey, "floor-plan"],
    queryFn: FindPlannerChannelOptions,
    staleTime: 30_000,
  });

  const channelOptions = useMemo(
    () => channelQuery.data ?? [],
    [channelQuery.data],
  );

  /**
   * 为什么在线状态来自当前拉取的通道列表而不是写进平面图：
   * `is_online` 会随设备心跳变化，持久化到 localStorage 会长期显示过期状态；用 channelId 查映射即可与绑定面板同源。
   */
  const channelOnlineById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const option of channelOptions) {
      map.set(option.value, option.isOnline);
    }
    return map;
  }, [channelOptions]);

  const selectedCamera = useMemo(() => {
    if (!selection || selection.cameraIds.length !== 1 || selection.wallIds.length > 0) {
      return null;
    }
    return plan.cameras.find((camera) => camera.id === selection.cameraIds[0]) ?? null;
  }, [plan.cameras, selection]);

  const selectedChannelOnline = useMemo(() => {
    const cid = selectedCamera?.channelId;
    if (!cid) {
      return null;
    }
    return channelOnlineById.has(cid) ? channelOnlineById.get(cid) ?? null : null;
  }, [channelOnlineById, selectedCamera?.channelId]);

  /**
   * 为什么工具栏再挂一份录像/告警入口：
   * 悬停卡片在 Portal 与 FAB 叠层场景下仍可能被现场浏览器差异影响命中；选中摄像头后顶部始终可点的图标链接与侧栏同源路由对象，给用户一条不依赖悬停的稳定跳转路径。
   */
  const selectedPlaybackTo = useMemo(
    () => (selectedCamera?.channelId ? buildPlaybackDetailTo(selectedCamera.channelId) : null),
    [selectedCamera?.channelId],
  );
  const selectedAlertsTo = useMemo(
    () => (selectedCamera?.channelId ? buildAlertsTo(selectedCamera.channelId) : null),
    [selectedCamera?.channelId],
  );

  const selectedWall = useMemo(() => {
    if (!selection || selection.wallIds.length !== 1 || selection.cameraIds.length > 0) {
      return null;
    }
    return plan.walls.find((wall) => wall.id === selection.wallIds[0]) ?? null;
  }, [plan.walls, selection]);

  const selectedWallCount = selection?.wallIds.length ?? 0;
  const selectedCameraCount = selection?.cameraIds.length ?? 0;
  const selectedTotal = selectionCount(selection);
  const isBatchSelection = selectedTotal > 1 || (selectedWallCount > 0 && selectedCameraCount > 0);

  const selectedGroupIds = useMemo(
    () => getSelectionGroupIds(plan, selection),
    [plan, selection],
  );

  const canGroup = selectedTotal > 1;
  const canUngroup = selectedGroupIds.length > 0;
  const canCopySelection = selectedTotal > 0;

  const hoveredCamera = useMemo(() => {
    if (!hoveredCameraId) {
      return null;
    }
    return plan.cameras.find((camera) => camera.id === hoveredCameraId) ?? null;
  }, [hoveredCameraId, plan.cameras]);

  const hoveredCameraScreenPosition = useMemo(() => {
    if (!hoveredCamera) {
      return null;
    }
    return worldToScreen({ x: hoveredCamera.x, y: hoveredCamera.y }, plan.view);
  }, [hoveredCamera, plan.view]);

  /**
   * 为什么录像入口与列表页拼相同 URL：
   * 详情页只解析 `cid`+`date`，与录像列表一致可减少「从平面图进入」与「从列表进入」两套行为，排障时也只对一种链接形态。
   */
  const cameraFilterTrim = channelNameFilter.trim().toLowerCase();

  /**
   * 为什么过滤同时匹配通道名与设备名：
   * 用户可能记得设备侧名称而记不清通道后缀，两边都搜能减少「明明绑了却筛不掉」的挫败感。
   */
  const cameraMatchesFilter = useCallback(
    (camera: CameraMarker) => {
      if (!cameraFilterTrim) {
        return true;
      }
      const name = (camera.channelName || "").toLowerCase();
      const device = (camera.deviceName || "").toLowerCase();
      return name.includes(cameraFilterTrim) || device.includes(cameraFilterTrim);
    },
    [cameraFilterTrim],
  );

  const filterMatches = useMemo(() => {
    if (!cameraFilterTrim) {
      return [];
    }
    return plan.cameras.filter((camera) => cameraMatchesFilter(camera));
  }, [cameraFilterTrim, cameraMatchesFilter, plan.cameras]);

  useEffect(() => {
    setFilterMatchIndex(0);
  }, [cameraFilterTrim]);

  useEffect(() => {
    if (filterMatches.length === 0) {
      return;
    }
    setFilterMatchIndex((index) => Math.min(index, filterMatches.length - 1));
  }, [filterMatches.length]);

  const boundCamerasForOverview = useMemo(
    () => plan.cameras.filter((camera) => Boolean(camera.channelId)),
    [plan.cameras],
  );

  useEffect(() => {
    if (loadFloorPlanGuideDismissed()) {
      return;
    }
    setGuideModalOpen(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const timer = window.setInterval(() => {
      setRelativeTimeTick((value) => value + 1);
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const relativeTimeNow = useMemo(() => Date.now(), [relativeTimeTick]);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  /**
   * 为什么历史栈要截断长度并归一化入栈：
   * 长时间编辑会无限增长内存；归一化保证栈里每一帧都可安全 JSON 化，与撤销/重做和 localStorage 同一套数据契约。
   */
  const pushHistory = useCallback((next: FloorPlanState) => {
    const normalized = cloneFloorPlanState(normalizeFloorPlanState(next));
    const base = historyRef.current.slice(0, historyIndexRef.current + 1);
    base.push(normalized);
    if (base.length > 80) {
      base.shift();
    }
    historyRef.current = base;
    historyIndexRef.current = base.length - 1;
    setHistoryVersion((value) => value + 1);
  }, []);

  /**
   * 为什么区分 commit：
   * 平移/缩放等视口操作不应污染「内容撤销栈」，否则用户撤销会把视图也卷回去，与常见编辑器心智冲突。
   */
  const replacePlan = useCallback(
    (next: FloorPlanState, commit = true) => {
      const normalized = normalizeFloorPlanState({
        ...next,
        updatedAt: Date.now(),
      });
      planRef.current = normalized;
      setPlan(normalized);
      if (commit) {
        pushHistory(normalized);
      }
    },
    [pushHistory],
  );

  /**
   * 为什么用非 passive 的 wheel 并 preventDefault：
   * 浏览器默认滚轮会滚动整页，画布需要把滚轮变成缩放；不阻止时大屏平面图无法稳定操作。
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      const delta = -event.deltaY;
      const factor = Math.exp(delta * 0.0012);
      replacePlan(zoomViewAtScreenPoint(planRef.current, sx, sy, factor), false);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [replacePlan]);

  /**
   * 为什么双指缩放挂在容器的 touch 上：
   * Konva 与单指拖动共存时，双指需在容器层统一处理，避免与节点命中竞争；锚点取两指中点与当前 scale 推导平移。
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const touchMid = (touches: TouchList, rect: DOMRect) => {
      if (touches.length < 2) {
        return null;
      }
      const a = touches[0];
      const b = touches[1];
      const mx = (a.clientX + b.clientX) / 2 - rect.left;
      const my = (a.clientY + b.clientY) / 2 - rect.top;
      const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      return { mx, my, dist };
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        const rect = el.getBoundingClientRect();
        const mid = touchMid(event.touches, rect);
        if (mid && mid.dist > 8) {
          pinchRef.current = { startDist: mid.dist, startScale: planRef.current.view.scale };
        }
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && pinchRef.current) {
        event.preventDefault();
        const rect = el.getBoundingClientRect();
        const mid = touchMid(event.touches, rect);
        if (!mid || mid.dist < 8) {
          return;
        }
        const { startDist, startScale } = pinchRef.current;
        const newScale = clamp(startScale * (mid.dist / startDist), 0.35, 3.2);
        const view = planRef.current.view;
        const worldX = (mid.mx - view.x) / view.scale;
        const worldY = (mid.my - view.y) / view.scale;
        replacePlan(
          {
            ...planRef.current,
            view: {
              scale: newScale,
              x: mid.mx - worldX * newScale,
              y: mid.my - worldY * newScale,
            },
          },
          false,
        );
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        pinchRef.current = null;
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [replacePlan]);

  /**
   * 为什么先 clone 再 recipe：
   * 可变 draft 直接改 plan 会让 React 与 Konva 难以比较前后差异；不可变快照配合归一化，调试时能打印完整前后状态。
   */
  const mutatePlan = useCallback(
    (recipe: (draft: FloorPlanState) => void, commit = true) => {
      const draft = cloneFloorPlanState(planRef.current);
      recipe(draft);
      draft.updatedAt = Date.now();
      replacePlan(draft, commit);
    },
    [replacePlan],
  );

  const boundChannelIdsKey = useMemo(() => {
    const ids = plan.cameras
      .map((camera) => camera.channelId)
      .filter((id): id is string => Boolean(id));
    return ids.sort().join("\0");
  }, [plan.cameras]);

  const lastEventPrefetchKeyRef = useRef("");

  /**
   * 为什么在进入平面图后批量预取最近事件：
   * 专用批量接口缺失时，仍可用时间排序的全局列表在客户端按 cid 归并；预取结果写入缓存与 marker，橙色状态与 hover 首屏即可对齐而无需逐个通道打 /events。
   */
  useEffect(() => {
    if (!boundChannelIdsKey) {
      lastEventPrefetchKeyRef.current = "";
      return;
    }
    if (boundChannelIdsKey === lastEventPrefetchKeyRef.current) {
      return;
    }

    const channelIds = boundChannelIdsKey.split("\0").filter(Boolean);
    let cancelled = false;

    void (async () => {
      const map = await prefetchLatestEventsForChannelIds(channelIds);
      if (cancelled) {
        return;
      }
      lastEventPrefetchKeyRef.current = boundChannelIdsKey;

      if (map.size === 0) {
        return;
      }

      mutatePlan((draft) => {
        for (const camera of draft.cameras) {
          if (!camera.channelId) {
            continue;
          }
          const latest = map.get(camera.channelId);
          if (!latest) {
            continue;
          }
          camera.latestEventAt = latest.startedAt;
          camera.latestEventImage = latest.imageSrc;
          camera.latestEventLabel = latest.label;
          camera.latestEventScore = latest.score;
        }
      }, false);
    })();

    return () => {
      cancelled = true;
    };
  }, [boundChannelIdsKey, mutatePlan]);

  /**
   * 为什么对齐线要显式清空：
   * 辅助线是瞬时 UI，若留在状态里会在下一次操作前误导用户以为仍在吸附；结束拖拽或取消时必须归零。
   */
  const clearGuides = useCallback(() => {
    setAlignmentGuides({ vertical: [], horizontal: [] });
  }, []);

  /**
   * 为什么切到浏览时强制回到选择工具并清空未提交的拖拽：
   * 浏览语义下不应停留在「画墙」等破坏性工具；若保留 wallDrawRef，全局 mousemove 仍会继续改预览，造成「已切浏览却仍在画」的错觉。
   */
  useEffect(() => {
    if (interactionMode === "browse") {
      setTool("select");
      wallDrawRef.current = null;
      roomDrawRef.current = null;
      marqueeRef.current = null;
      dragSelectionRef.current = null;
      dragWallHandleRef.current = null;
      panRef.current = null;
      setWallPreview(null);
      setRoomPreview(null);
      setMarqueeRect(null);
      clearGuides();
    }
  }, [interactionMode, clearGuides]);

  /**
   * 为什么适配用包围盒加 padding：
   * 贴边缩放会让墙线贴紧视口边缘难以继续向外编辑，留白给后续拖动与框选留余地。
   */
  const zoomToFit = useCallback(() => {
    const bounds = getPlanBounds(planRef.current);
    const width = Math.max(240, bounds.maxX - bounds.minX + 280);
    const height = Math.max(240, bounds.maxY - bounds.minY + 280);
    const scale = clamp(
      Math.min(viewportSize.width / width, viewportSize.height / height),
      0.35,
      2.4,
    );

    replacePlan(
      {
        ...planRef.current,
        view: {
          scale,
          x: viewportSize.width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
          y: viewportSize.height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
        },
      },
      false,
    );
  }, [replacePlan, viewportSize.height, viewportSize.width]);

  /**
   * 为什么「只看摄像头」单独一条缩放路径：
   * 墙线往往铺满整张世界画布，与全图适配等价于 zoom out 到几乎看不清探头；运维查机位时更需要围绕绑定通道的点阵取景。
   */
  const zoomToFitCameras = useCallback(
    (cameras: CameraMarker[]) => {
      const bounds = getCamerasBounds(cameras);
      if (!bounds) {
        return;
      }
      const pad = FLOOR_PLAN_GRID_SIZE * 6;
      const width = Math.max(240, bounds.maxX - bounds.minX + pad * 2);
      const height = Math.max(240, bounds.maxY - bounds.minY + pad * 2);
      const scale = clamp(
        Math.min(viewportSize.width / width, viewportSize.height / height),
        0.35,
        2.4,
      );
      replacePlan(
        {
          ...planRef.current,
          view: {
            scale,
            x: viewportSize.width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
            y: viewportSize.height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
          },
        },
        false,
      );
    },
    [replacePlan, viewportSize.height, viewportSize.width],
  );

  const centerViewOnWorld = useCallback(
    (worldX: number, worldY: number) => {
      const view = planRef.current.view;
      replacePlan(
        {
          ...planRef.current,
          view: {
            ...view,
            x: viewportSize.width / 2 - worldX * view.scale,
            y: viewportSize.height / 2 - worldY * view.scale,
          },
        },
        false,
      );
    },
    [replacePlan, viewportSize.height, viewportSize.width],
  );

  const navigateFilterMatch = useCallback(
    (delta: number) => {
      if (filterMatches.length === 0) {
        return;
      }
      const next = (filterMatchIndex + delta + filterMatches.length) % filterMatches.length;
      setFilterMatchIndex(next);
      const target = filterMatches[next];
      if (target) {
        setSelection(createSelection([], [target.id]));
        centerViewOnWorld(target.x, target.y);
      }
    },
    [centerViewOnWorld, filterMatchIndex, filterMatches],
  );

  const frameFilterMatches = useCallback(() => {
    if (filterMatches.length === 0) {
      return;
    }
    zoomToFitCameras(filterMatches);
  }, [filterMatches, zoomToFitCameras]);

  const hoverCardEventAgo = useMemo(
    () =>
      hoverEvent?.startedAt
        ? formatTimeAgoFromMs(hoverEvent.startedAt, relativeTimeNow, t)
        : "",
    [hoverEvent?.startedAt, relativeTimeNow, t],
  );
  const hoverCardDataAgo = useMemo(
    () =>
      hoverEventFetchedAt ? formatTimeAgoFromMs(hoverEventFetchedAt, relativeTimeNow, t) : "",
    [hoverEventFetchedAt, relativeTimeNow, t],
  );
  const panelEventOccurredAgo = useMemo(
    () =>
      panelLatestEvent?.startedAt
        ? formatTimeAgoFromMs(panelLatestEvent.startedAt, relativeTimeNow, t)
        : "",
    [panelLatestEvent?.startedAt, relativeTimeNow, t],
  );
  const panelDataFetchedAgo = useMemo(
    () =>
      panelEventFetchedAt ? formatTimeAgoFromMs(panelEventFetchedAt, relativeTimeNow, t) : "",
    [panelEventFetchedAt, relativeTimeNow, t],
  );

  /**
   * 为什么属性面板只改「当前选中的单个摄像头」：
   * 批量选中时 FOV 等参数语义不明确（是否应用全部），限制为单选避免静默改多机位引发事故。
   */
  const updateSelectedCamera = useCallback(
    (recipe: (camera: CameraMarker) => void, commit = true) => {
      if (!selectedCamera) {
        return;
      }
      mutatePlan((draft) => {
        const camera = draft.cameras.find((item) => item.id === selectedCamera.id);
        if (!camera) {
          return;
        }
        recipe(camera);
      }, commit);
    },
    [mutatePlan, selectedCamera],
  );

  /**
   * 为什么删除要用 selectionRef 而不是闭包里的 selection：
   * 键盘删除与鼠标操作可能在同一 tick 交错，ref 指向「发起删除瞬间」的快照，避免 React 批处理滞后导致删错对象。
   */
  const deleteSelection = useCallback(() => {
    const currentSelection = selectionRef.current;
    if (!currentSelection) {
      return;
    }
    mutatePlan((draft) => {
      draft.cameras = draft.cameras.filter(
        (camera) => !currentSelection.cameraIds.includes(camera.id),
      );
      draft.walls = draft.walls.filter((wall) => !currentSelection.wallIds.includes(wall.id));
    });
    setSelection(null);
  }, [mutatePlan]);

  /**
   * 为什么复制只写 ref 并复位 cascade：
   * 剪贴板与画布状态解耦，用户复制后可能大幅编辑再粘贴，保持一份快照即可；cascade 归零避免与上一次连续粘贴偏移叠加混乱。
   */
  const copySelection = useCallback(() => {
    const clipboard = buildClipboard(planRef.current, selectionRef.current);
    clipboardRef.current = clipboard;
    pasteCascadeRef.current = 0;
    setHasClipboard(Boolean(clipboard));
  }, []);

  /**
   * 为什么优先用鼠标世界坐标作为粘贴锚点：
   * 用户目光通常跟随光标，把结构落在指针附近比固定落在画布原点减少拖拽校正；拿不到指针时再回退视口中心避免粘贴到视野外。
   */
  const resolvePasteTopLeft = useCallback((clipboard: PlannerClipboardState) => {
    const pointerWorld = pointerWorldRef.current;
    if (
      pointerWorld &&
      Number.isFinite(pointerWorld.x) &&
      Number.isFinite(pointerWorld.y)
    ) {
      return clampPasteTopLeft(
        {
          x: pointerWorld.x - clipboard.width / 2,
          y: pointerWorld.y - clipboard.height / 2,
        },
        clipboard,
      );
    }

    const viewportCenter = getViewportCenter(planRef.current.view, viewportSize);
    return clampPasteTopLeft(
      {
        x: viewportCenter.x - clipboard.width / 2,
        y: viewportCenter.y - clipboard.height / 2,
      },
      clipboard,
    );
  }, [viewportSize]);

  /**
   * 为什么连续粘贴要递增 cascadeOffset：
   * 多次 Ctrl+V 若落在同一点会完全重叠难以分辨，按网格阶梯偏移让副本呈「栈」状展开，符合常见图形软件行为。
   */
  const pasteClipboard = useCallback(
    (mode: "pointer" | "duplicate" = "pointer") => {
      const clipboard = clipboardRef.current;
      if (!clipboard) {
        return;
      }

      pasteCascadeRef.current += 1;
      const cascadeOffset = FLOOR_PLAN_GRID_SIZE * Math.min(6, pasteCascadeRef.current);
      const pointerTopLeft = resolvePasteTopLeft(clipboard);
      const rawTargetTopLeft =
        mode === "duplicate"
          ? {
              x: clipboard.bounds.minX + cascadeOffset,
              y: clipboard.bounds.minY + cascadeOffset,
            }
          : {
              x: pointerTopLeft.x + cascadeOffset,
              y: pointerTopLeft.y + cascadeOffset,
            };

      const targetTopLeft = clampPasteTopLeft(rawTargetTopLeft, clipboard);
      const pasted = createPastedEntities(clipboard, targetTopLeft);

      mutatePlan((draft) => {
        draft.walls.push(...pasted.walls);
        draft.cameras.push(...pasted.cameras);
      });
      setSelection(
        createSelection(
          pasted.walls.map((wall) => wall.id),
          pasted.cameras.map((camera) => camera.id),
        ),
      );
      setTool("select");
    },
    [mutatePlan, resolvePasteTopLeft],
  );

  /**
   * 为什么重复选择在复制后立刻粘贴并固定偏移：
   * 用户期望「一键多份」比先复制再手动粘贴少一步，固定网格偏移保证不与原物体重叠。
   */
  const duplicateSelection = useCallback(() => {
    const clipboard = buildClipboard(planRef.current, selectionRef.current);
    if (!clipboard) {
      return;
    }
    clipboardRef.current = clipboard;
    setHasClipboard(true);
    pasteCascadeRef.current = 1;

    const targetTopLeft = clampPasteTopLeft(
      {
        x: clipboard.bounds.minX + FLOOR_PLAN_GRID_SIZE * 2,
        y: clipboard.bounds.minY + FLOOR_PLAN_GRID_SIZE * 2,
      },
      clipboard,
    );
    const pasted = createPastedEntities(clipboard, targetTopLeft);

    mutatePlan((draft) => {
      draft.walls.push(...pasted.walls);
      draft.cameras.push(...pasted.cameras);
    });
    setSelection(
      createSelection(
        pasted.walls.map((wall) => wall.id),
        pasted.cameras.map((camera) => camera.id),
      ),
    );
    setTool("select");
  }, [mutatePlan]);

  /**
   * 为什么编组只打 groupId 而不嵌套结构：
   * 墙与摄像头仍是扁平列表，撤销与序列化逻辑简单；groupId 作为弱引用标签，移动时按 id 批量更新即可。
   */
  const groupSelection = useCallback(() => {
    const currentSelection = selectionRef.current;
    if (selectionCount(currentSelection) < 2) {
      return;
    }
    const groupId = createGroupId();
    mutatePlan((draft) => {
      draft.walls.forEach((wall) => {
        if (currentSelection?.wallIds.includes(wall.id)) {
          wall.groupId = groupId;
        }
      });
      draft.cameras.forEach((camera) => {
        if (currentSelection?.cameraIds.includes(camera.id)) {
          camera.groupId = groupId;
        }
      });
    });
  }, [mutatePlan]);

  /**
   * 为什么解组只清当前选区涉及的实体：
   * 用户可能只想拆开一部分，全表清空会误伤未选中的同组对象。
   */
  const ungroupSelection = useCallback(() => {
    const currentSelection = selectionRef.current;
    if (!currentSelection) {
      return;
    }
    mutatePlan((draft) => {
      draft.walls.forEach((wall) => {
        if (currentSelection.wallIds.includes(wall.id)) {
          wall.groupId = null;
        }
      });
      draft.cameras.forEach((camera) => {
        if (currentSelection.cameraIds.includes(camera.id)) {
          camera.groupId = null;
        }
      });
    });
  }, [mutatePlan]);

  /**
   * 为什么撤销要清空选择与辅助线：
   * 快照回到过去某一帧时，选中的 id 可能已不存在，保留选择会导致指向幽灵实体；辅助线同理。
   */
  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) {
      return;
    }
    historyIndexRef.current -= 1;
    const snapshot = cloneFloorPlanState(historyRef.current[historyIndexRef.current]);
    planRef.current = snapshot;
    setPlan(snapshot);
    setSelection(null);
    clearGuides();
    setHistoryVersion((value) => value + 1);
  }, [clearGuides]);

  /**
   * 为什么重做与撤销对称处理：
   * 恢复的未来帧同样可能使旧 selection 失效，清空后由用户重新点选成本低于修复不一致状态。
   */
  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) {
      return;
    }
    historyIndexRef.current += 1;
    const snapshot = cloneFloorPlanState(historyRef.current[historyIndexRef.current]);
    planRef.current = snapshot;
    setPlan(snapshot);
    setSelection(null);
    clearGuides();
    setHistoryVersion((value) => value + 1);
  }, [clearGuides]);

  /**
   * 为什么侧栏单独拉一次最近事件：
   * 用户选中摄像头时期望在右栏直接看到摘要，而不必依赖 hover；与 hover 共用 `getLatestCameraEvent` 缓存，避免重复打后端。
   */
  useEffect(() => {
    if (!selectedCamera?.channelId) {
      setPanelLatestEvent(null);
      setPanelEventLoading(false);
      setPanelEventFetchedAt(null);
      return;
    }

    let cancelled = false;
    setPanelEventLoading(true);
    setPanelLatestEvent(null);

    void (async () => {
      const latest = await getLatestCameraEvent(selectedCamera.channelId);
      if (!cancelled) {
        setPanelLatestEvent(latest);
        setPanelEventLoading(false);
        setPanelEventFetchedAt(Date.now());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCamera?.channelId, selectedCamera?.id, panelEventRefreshToken]);

  const refreshPanelEvent = useCallback(() => {
    if (!selectedCamera?.channelId) {
      return;
    }
    clearLatestCameraEventCache(selectedCamera.channelId);
    setPanelEventRefreshToken((value) => value + 1);
  }, [selectedCamera?.channelId]);

  /**
   * 为什么 hover 拉事件后写回 camera 上的 latest* 字段：
   * 橙色状态需要持久化到同一 plan，刷新前多次进入页面能复用已拉取结果；commit=false 避免污染撤销栈。
   */
  const loadHoverEvent = useCallback(
    async (camera: CameraMarker | null) => {
      if (!camera?.channelId) {
        setHoverEvent(null);
        setHoverLoading(false);
        setHoverEventFetchedAt(null);
        return;
      }

      setHoverEvent(null);
      setHoverEventFetchedAt(null);
      setHoverLoading(true);
      try {
        const latest = await getLatestCameraEvent(camera.channelId);
        setHoverEvent(latest);

        if (!latest) {
          return;
        }

        mutatePlan((draft) => {
          const target = draft.cameras.find((item) => item.id === camera.id);
          if (!target) {
            return;
          }
          target.latestEventAt = latest.startedAt;
          target.latestEventImage = latest.imageSrc;
          target.latestEventLabel = latest.label;
          target.latestEventScore = latest.score;
        }, false);
      } finally {
        setHoverLoading(false);
        setHoverEventFetchedAt(Date.now());
      }
    },
    [mutatePlan],
  );

  /**
   * 为什么插入预设后自动框选并切回选择工具：
   * 用户下一步通常是微调或编组，停留在墙线工具容易误画；选中全部新墙线提供即时视觉反馈。
   */
  const insertPreset = useCallback(
    (templateId: FloorPlanTemplateId) => {
      const center = getViewportCenter(planRef.current.view, viewportSize);
      const walls = createPresetWalls(templateId, center);
      if (walls.length === 0) {
        return;
      }
      mutatePlan((draft) => {
        draft.walls.push(...walls);
      });
      setSelection(createSelection(walls.map((wall) => wall.id), []));
      setTool("select");
    },
    [mutatePlan, viewportSize],
  );

  /**
   * 为什么拖动开始要冻结 wallOrigins/cameraOrigins：
   * 拖动中 mutatePlan 会不断更新坐标，若用实时值作为「起点」会产生反馈回路导致漂移；快照锚定一次拖动周期。
   */
  const buildDragSelectionSnapshot = useCallback(
    (nextSelection: PlannerSelection, startWorld: PlannerPoint) => {
      if (!nextSelection) {
        return null;
      }

      const selectedWalls = planRef.current.walls.filter((wall) =>
        nextSelection.wallIds.includes(wall.id),
      );
      const selectedCameras = planRef.current.cameras.filter((camera) =>
        nextSelection.cameraIds.includes(camera.id),
      );

      const xValues = [
        ...selectedWalls.flatMap((wall) => [wall.x1, wall.x2]),
        ...selectedCameras.map((camera) => camera.x),
      ];
      const yValues = [
        ...selectedWalls.flatMap((wall) => [wall.y1, wall.y2]),
        ...selectedCameras.map((camera) => camera.y),
      ];

      return {
        wallIds: nextSelection.wallIds,
        cameraIds: nextSelection.cameraIds,
        startWorld,
        moved: false,
        bounds: {
          minX: xValues.length > 0 ? Math.min(...xValues) : 0,
          maxX: xValues.length > 0 ? Math.max(...xValues) : 0,
          minY: yValues.length > 0 ? Math.min(...yValues) : 0,
          maxY: yValues.length > 0 ? Math.max(...yValues) : 0,
        },
        wallOrigins: Object.fromEntries(selectedWalls.map((wall) => [wall.id, { ...wall }])),
        cameraOrigins: Object.fromEntries(
          selectedCameras.map((camera) => [camera.id, { x: camera.x, y: camera.y }]),
        ),
      } satisfies SelectionDragSnapshot;
    },
    [],
  );

  /**
   * 为什么拖动增量要先约束在世界范围内再吸附：
   * 先吸附再裁剪可能导致穿出边界仍显示辅助线，用户会误以为已对齐到墙外；先 clamp 再对齐保证几何一致。
   */
  const resolveAlignedSelectionDelta = useCallback(
    (snapshot: SelectionDragSnapshot, rawDeltaX: number, rawDeltaY: number, constrained: boolean) => {
      const dragDelta = constrainDragDelta(rawDeltaX, rawDeltaY, constrained);
      let deltaX = clamp(
        dragDelta.deltaX,
        -snapshot.bounds.minX,
        FLOOR_PLAN_WORLD_WIDTH - snapshot.bounds.maxX,
      );
      let deltaY = clamp(
        dragDelta.deltaY,
        -snapshot.bounds.minY,
        FLOOR_PLAN_WORLD_HEIGHT - snapshot.bounds.maxY,
      );

      const movingValues = getSnapshotGuideValues(snapshot);
      const references = getGuideReferenceValues(planRef.current, {
        wallIds: snapshot.wallIds,
        cameraIds: snapshot.cameraIds,
      });

      const xGuide = findGuideAdjustment(
        movingValues.xValues.map((value) => value + deltaX),
        references.xValues,
      );
      const yGuide = findGuideAdjustment(
        movingValues.yValues.map((value) => value + deltaY),
        references.yValues,
      );

      deltaX = clamp(
        deltaX + xGuide.delta,
        -snapshot.bounds.minX,
        FLOOR_PLAN_WORLD_WIDTH - snapshot.bounds.maxX,
      );
      deltaY = clamp(
        deltaY + yGuide.delta,
        -snapshot.bounds.minY,
        FLOOR_PLAN_WORLD_HEIGHT - snapshot.bounds.maxY,
      );

      setAlignmentGuides({
        vertical: xGuide.guide === null ? [] : [xGuide.guide],
        horizontal: yGuide.guide === null ? [] : [yGuide.guide],
      });

      return { deltaX, deltaY };
    },
    [],
  );

  /**
   * 为什么端点拖动要排除当前墙自身再取参考：
   * 若不排除，端点会与自己的另一端虚假对齐，辅助线常驻失去参考意义。
   */
  const resolveAlignedWallHandlePoint = useCallback(
    (wallId: string, endpoint: "start" | "end", point: PlannerPoint, constrained: boolean, anchor: PlannerPoint) => {
      const nextPoint = constrained ? snapWallEnd(anchor, point) : point;
      const references = getGuideReferenceValues(planRef.current, createSelection([wallId], []));
      const xGuide = findGuideAdjustment([nextPoint.x], references.xValues);
      const yGuide = findGuideAdjustment([nextPoint.y], references.yValues);

      const alignedPoint = clampPointToWorld(
        snapPoint({
          x: nextPoint.x + xGuide.delta,
          y: nextPoint.y + yGuide.delta,
        }),
      );

      setAlignmentGuides({
        vertical: xGuide.guide === null ? [] : [xGuide.guide],
        horizontal: yGuide.guide === null ? [] : [yGuide.guide],
      });

      return endpoint === "start"
        ? alignedPoint
        : alignedPoint;
    },
    [],
  );

  /**
   * 为什么把画布级交互挂在 document 的 mousemove/mouseup 上：
   * 指针快速拖出 Stage 时仍会丢失事件，墙线/框选/平移必须在全局跟踪，否则出现「松手仍以为在拖」的僵死状态。
   */
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      // 无论当前是否在拖拽，都持续刷新最近一次鼠标所在世界坐标，保证键盘粘贴和工具栏粘贴都能贴到用户当前关注点。
      const containerRect = container.getBoundingClientRect();
      if (
        event.clientX >= containerRect.left &&
        event.clientX <= containerRect.right &&
        event.clientY >= containerRect.top &&
        event.clientY <= containerRect.bottom
      ) {
        pointerWorldRef.current = clampPointToWorld(
          snapPoint(clientToWorld(event.clientX, event.clientY, container, planRef.current.view)),
        );
      }

      if (interactionModeRef.current === "browse") {
        if (panRef.current) {
          const deltaX = event.clientX - panRef.current.startX;
          const deltaY = event.clientY - panRef.current.startY;
          replacePlan(
            {
              ...planRef.current,
              view: {
                ...planRef.current.view,
                x: panRef.current.originX + deltaX,
                y: panRef.current.originY + deltaY,
              },
            },
            false,
          );
        } else if (marqueeRef.current) {
          const current = clampPointToWorld(
            snapPoint(
              clientToWorld(event.clientX, event.clientY, container, planRef.current.view),
            ),
          );
          marqueeRef.current.current = current;
          const rect = normalizeRect(marqueeRef.current.start, current);
          setMarqueeRect(rect);
        }
        return;
      }

      if (panRef.current) {
        const deltaX = event.clientX - panRef.current.startX;
        const deltaY = event.clientY - panRef.current.startY;
        replacePlan(
          {
            ...planRef.current,
            view: {
              ...planRef.current.view,
              x: panRef.current.originX + deltaX,
              y: panRef.current.originY + deltaY,
            },
          },
          false,
        );
        return;
      }

      if (wallDrawRef.current) {
        const current = clampPointToWorld(
          snapPoint(
            clientToWorld(event.clientX, event.clientY, container, planRef.current.view),
          ),
        );
        // 墙线默认支持任意角度绘制；按住 Shift 时再切换为正交约束。
        setWallPreview({
          start: wallDrawRef.current.start,
          end: event.shiftKey ? snapWallEnd(wallDrawRef.current.start, current) : current,
        });
        return;
      }

      if (roomDrawRef.current) {
        const current = clampPointToWorld(
          snapPoint(
            clientToWorld(event.clientX, event.clientY, container, planRef.current.view),
          ),
        );
        setRoomPreview({ start: roomDrawRef.current.start, end: current });
        return;
      }

      if (marqueeRef.current) {
        const current = clampPointToWorld(
          snapPoint(
            clientToWorld(event.clientX, event.clientY, container, planRef.current.view),
          ),
        );
        marqueeRef.current.current = current;
        const rect = normalizeRect(marqueeRef.current.start, current);
        setMarqueeRect(rect);
        return;
      }

      if (dragSelectionRef.current) {
        const world = clampPointToWorld(
          snapPoint(
            clientToWorld(event.clientX, event.clientY, container, planRef.current.view),
          ),
        );
        const rawDeltaX = world.x - dragSelectionRef.current.startWorld.x;
        const rawDeltaY = world.y - dragSelectionRef.current.startWorld.y;
        const aligned = resolveAlignedSelectionDelta(
          dragSelectionRef.current,
          rawDeltaX,
          rawDeltaY,
          event.shiftKey,
        );

        dragSelectionRef.current.moved = true;
        mutatePlan((draft) => {
          draft.walls.forEach((wall) => {
            const origin = dragSelectionRef.current?.wallOrigins[wall.id];
            if (!origin) {
              return;
            }
            wall.x1 = origin.x1 + aligned.deltaX;
            wall.y1 = origin.y1 + aligned.deltaY;
            wall.x2 = origin.x2 + aligned.deltaX;
            wall.y2 = origin.y2 + aligned.deltaY;
          });
          draft.cameras.forEach((camera) => {
            const origin = dragSelectionRef.current?.cameraOrigins[camera.id];
            if (!origin) {
              return;
            }
            camera.x = origin.x + aligned.deltaX;
            camera.y = origin.y + aligned.deltaY;
          });
        }, false);
        return;
      }

      if (dragWallHandleRef.current) {
        const world = clampPointToWorld(
          snapPoint(
            clientToWorld(event.clientX, event.clientY, container, planRef.current.view),
          ),
        );
        const alignedPoint = resolveAlignedWallHandlePoint(
          dragWallHandleRef.current.wallId,
          dragWallHandleRef.current.endpoint,
          world,
          event.shiftKey,
          dragWallHandleRef.current.anchor,
        );

        dragWallHandleRef.current.moved = true;
        mutatePlan((draft) => {
          const wall = draft.walls.find(
            (item) => item.id === dragWallHandleRef.current?.wallId,
          );
          if (!wall) {
            return;
          }
          if (dragWallHandleRef.current?.endpoint === "start") {
            wall.x1 = alignedPoint.x;
            wall.y1 = alignedPoint.y;
          } else {
            wall.x2 = alignedPoint.x;
            wall.y2 = alignedPoint.y;
          }
        }, false);
      }
    };

    /**
     * 为什么在 mouseup 才 commit 拖动历史：
     * 拖动过程中用 mutatePlan(..., false) 避免每一步入撤销栈；仅在松手时 pushHistory，撤销一步即可回到拖动前整帧。
     */
    const handleMouseUp = () => {
      if (panRef.current) {
        panRef.current = null;
      }

      if (wallDrawRef.current) {
        const preview = wallPreview;
        wallDrawRef.current = null;
        setWallPreview(null);
        if (preview && (preview.start.x !== preview.end.x || preview.start.y !== preview.end.y)) {
          const wall: FloorWall = {
            id: createWallId(),
            x1: preview.start.x,
            y1: preview.start.y,
            x2: preview.end.x,
            y2: preview.end.y,
            groupId: null,
          };
          mutatePlan((draft) => {
            draft.walls.push(wall);
          });
          setSelection(createSelection([wall.id], []));
        }
      }

      if (roomDrawRef.current) {
        const preview = roomPreview;
        roomDrawRef.current = null;
        setRoomPreview(null);
        if (preview) {
          const walls = createRectangleWalls(preview.start, preview.end);
          if (walls.length > 0) {
            mutatePlan((draft) => {
              draft.walls.push(...walls);
            });
            setSelection(createSelection(walls.map((wall) => wall.id), []));
          }
        }
      }

      if (marqueeRef.current) {
        const { start, current, additive } = marqueeRef.current;
        marqueeRef.current = null;
        setMarqueeRect(null);
        const nextSelection = selectionFromRect(planRef.current, start, current);
        setSelection((previous) => (additive ? mergeSelections(previous, nextSelection) : nextSelection));
      }

      if (dragSelectionRef.current) {
        const moved = dragSelectionRef.current.moved;
        dragSelectionRef.current = null;
        clearGuides();
        if (moved) {
          pushHistory(planRef.current);
        }
      }

      if (dragWallHandleRef.current) {
        const moved = dragWallHandleRef.current.moved;
        dragWallHandleRef.current = null;
        clearGuides();
        if (moved) {
          pushHistory(planRef.current);
        }
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    clearGuides,
    mutatePlan,
    pushHistory,
    replacePlan,
    resolveAlignedSelectionDelta,
    resolveAlignedWallHandlePoint,
    roomPreview,
    wallPreview,
  ]);

  /**
   * 为什么平移要记录指针起点与 view 原点：
   * 用增量差更新 view.x/y 避免浮点累积误差；与缩放矩阵解耦，平移不触发内容历史。
   */
  const beginPan = useCallback((clientX: number, clientY: number) => {
    panRef.current = {
      startX: clientX,
      startY: clientY,
      originX: planRef.current.view.x,
      originY: planRef.current.view.y,
    };
  }, []);

  /**
   * 为什么方向键微调复用 buildDragSelectionSnapshot 的边界：
   * 与鼠标拖动共享同一世界边界约束，避免键盘把对象推出可编辑区域而鼠标拖不回来。
   */
  const nudgeSelection = useCallback(
    (rawDeltaX: number, rawDeltaY: number) => {
      const currentSelection = selectionRef.current;
      if (!currentSelection) {
        return;
      }

      const snapshot = buildDragSelectionSnapshot(currentSelection, { x: 0, y: 0 });
      if (!snapshot) {
        return;
      }

      const deltaX = clamp(
        rawDeltaX,
        -snapshot.bounds.minX,
        FLOOR_PLAN_WORLD_WIDTH - snapshot.bounds.maxX,
      );
      const deltaY = clamp(
        rawDeltaY,
        -snapshot.bounds.minY,
        FLOOR_PLAN_WORLD_HEIGHT - snapshot.bounds.maxY,
      );

      if (deltaX === 0 && deltaY === 0) {
        return;
      }

      mutatePlan((draft) => {
        draft.walls.forEach((wall) => {
          const origin = snapshot.wallOrigins[wall.id];
          if (!origin) {
            return;
          }
          wall.x1 = origin.x1 + deltaX;
          wall.y1 = origin.y1 + deltaY;
          wall.x2 = origin.x2 + deltaX;
          wall.y2 = origin.y2 + deltaY;
        });
        draft.cameras.forEach((camera) => {
          const origin = snapshot.cameraOrigins[camera.id];
          if (!origin) {
            return;
          }
          camera.x = origin.x + deltaX;
          camera.y = origin.y + deltaY;
        });
      });
    },
    [buildDragSelectionSnapshot, mutatePlan],
  );

  /**
   * 为什么在 document 监听 keydown 并过滤输入框：
   * 快捷键需要全局生效，但用户在通道搜索框输入时不能误触删除/全选，否则会造成数据与画布双误操作。
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        Boolean(target?.isContentEditable);
      if (isTypingTarget) {
        return;
      }

      if (interactionModeRef.current === "browse") {
        if (event.key === "Escape") {
          setSelection(null);
          clearGuides();
        }
        return;
      }

      const isMeta = event.ctrlKey || event.metaKey;

      if (isMeta && event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
        return;
      }

      if (isMeta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
        return;
      }

      if (isMeta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }

      if (isMeta && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelection();
        return;
      }

      if (isMeta && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteClipboard();
        return;
      }

      if (isMeta && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelection();
        return;
      }

      if (isMeta && event.key.toLowerCase() === "g" && event.shiftKey) {
        event.preventDefault();
        ungroupSelection();
        return;
      }

      if (isMeta && event.key.toLowerCase() === "g") {
        event.preventDefault();
        groupSelection();
        return;
      }

      if (isMeta && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelection(
          createSelection(
            planRef.current.walls.map((wall) => wall.id),
            planRef.current.cameras.map((camera) => camera.id),
          ),
        );
        return;
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        const step = event.shiftKey ? FLOOR_PLAN_GRID_SIZE * 2 : FLOOR_PLAN_GRID_SIZE;
        const deltas = {
          ArrowUp: { x: 0, y: -step },
          ArrowDown: { x: 0, y: step },
          ArrowLeft: { x: -step, y: 0 },
          ArrowRight: { x: step, y: 0 },
        } as const;
        const next = deltas[event.key as keyof typeof deltas];
        if (next) {
          event.preventDefault();
          nudgeSelection(next.x, next.y);
          return;
        }
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelection();
        return;
      }

      if (event.key === "Escape") {
        wallDrawRef.current = null;
        roomDrawRef.current = null;
        marqueeRef.current = null;
        dragSelectionRef.current = null;
        dragWallHandleRef.current = null;
        setWallPreview(null);
        setRoomPreview(null);
        setMarqueeRect(null);
        clearGuides();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    clearGuides,
    copySelection,
    deleteSelection,
    duplicateSelection,
    groupSelection,
    nudgeSelection,
    pasteClipboard,
    redo,
    undo,
    ungroupSelection,
  ]);

  /**
   * 为什么指针坐标统一走 clientToWorld + snap：
   * 所有工具共享同一套坐标变换，避免墙线端点与摄像头放置出现系统性半格偏差。
   */
  const resolvePointerWorld = useCallback((event: MouseEvent) => {
    const container = containerRef.current;
    if (!container) {
      return null;
    }
    return clampPointToWorld(
      snapPoint(clientToWorld(event.clientX, event.clientY, container, planRef.current.view)),
    );
  }, []);

  /**
   * 为什么 Stage 的 mousedown 要分流工具与中键：
   * 画布空白处行为完全由当前工具决定，若放到子图形上处理会漏掉「点在空白」的路径；中键平移需优先于绘制避免浏览器默认滚动。
   */
  const handleStageMouseDown = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      if (event.evt.button === 1 || (tool === "pan" && event.evt.button === 0)) {
        event.evt.preventDefault();
        beginPan(event.evt.clientX, event.evt.clientY);
        return;
      }

      if (event.evt.button !== 0) {
        return;
      }

      if (interactionModeRef.current === "browse") {
        clearGuides();
        const worldPoint = resolvePointerWorld(event.evt);
        if (!worldPoint) {
          return;
        }
        pointerWorldRef.current = worldPoint;
        const additive = event.evt.ctrlKey || event.evt.metaKey;
        marqueeRef.current = {
          start: worldPoint,
          current: worldPoint,
          additive,
        };
        setMarqueeRect(normalizeRect(worldPoint, worldPoint));
        if (!additive) {
          setSelection(null);
        }
        return;
      }

      clearGuides();
      const worldPoint = resolvePointerWorld(event.evt);
      if (!worldPoint) {
        return;
      }
      pointerWorldRef.current = worldPoint;

      if (tool === "camera") {
        const camera = createCameraMarker(worldPoint);
        mutatePlan((draft) => {
          draft.cameras.push(camera);
        });
        setSelection(createSelection([], [camera.id]));
        return;
      }

      if (tool === "wall") {
        wallDrawRef.current = { start: worldPoint };
        setWallPreview({ start: worldPoint, end: worldPoint });
        return;
      }

      if (tool === "room") {
        roomDrawRef.current = { start: worldPoint };
        setRoomPreview({ start: worldPoint, end: worldPoint });
        return;
      }

      if (tool === "select") {
        const additive = event.evt.ctrlKey || event.evt.metaKey;
        marqueeRef.current = {
          start: worldPoint,
          current: worldPoint,
          additive,
        };
        setMarqueeRect(normalizeRect(worldPoint, worldPoint));
        if (!additive) {
          setSelection(null);
        }
        return;
      }

      if (!(event.evt.ctrlKey || event.evt.metaKey)) {
        setSelection(null);
      }
    },
    [beginPan, clearGuides, mutatePlan, resolvePointerWorld, tool],
  );

  /**
   * 为什么摄像头点击要 cancelBubble：
   * 事件会冒泡到 Stage 触发框选清空，必须先截获再决定是选中/多选/Alt 复制，否则无法稳定选中单个摄像头。
   */
  const handleCameraMouseDown = useCallback(
    (cameraId: string, event: KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      if (event.evt.button === 1) {
        event.evt.preventDefault();
        beginPan(event.evt.clientX, event.evt.clientY);
        return;
      }

      if (event.evt.button !== 0) {
        return;
      }

      clearGuides();
      if (event.evt.ctrlKey || event.evt.metaKey) {
        setSelection((current) => toggleEntitySelection(current, "camera", cameraId));
        return;
      }

      const baseSelection = isEntitySelected(selectionRef.current, "camera", cameraId)
        ? selectionRef.current
        : selectEntity(planRef.current, "camera", cameraId);
      setSelection(baseSelection);

      if (interactionModeRef.current === "browse") {
        return;
      }

      if (tool !== "select") {
        return;
      }

      const startWorld = resolvePointerWorld(event.evt);
      if (!startWorld) {
        return;
      }

      // 选择模式下按住 Alt 拖动，可先复制当前选择集，再直接拖走副本。
      if (event.evt.altKey) {
        const duplicated = duplicateSelectionAtSource(planRef.current, baseSelection);
        if (duplicated) {
          clipboardRef.current = duplicated.clipboard;
          pasteCascadeRef.current = 0;
          setHasClipboard(true);
          mutatePlan((draft) => {
            draft.walls.push(...duplicated.pasted.walls);
            draft.cameras.push(...duplicated.pasted.cameras);
          });
          setSelection(duplicated.selection);
          dragSelectionRef.current = buildDragSelectionSnapshot(duplicated.selection, startWorld);
          return;
        }
      }

      dragSelectionRef.current = buildDragSelectionSnapshot(baseSelection, startWorld);
    },
    [beginPan, buildDragSelectionSnapshot, clearGuides, resolvePointerWorld, tool],
  );

  /**
   * 为什么墙线 mousedown 与摄像头逻辑平行：
   * 墙与摄像头共享多选、编组展开、Alt 复制语义，拆两个 handler 只为命中测试不同，行为一致才能降低学习成本。
   */
  const handleWallMouseDown = useCallback(
    (wall: FloorWall, event: KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      if (event.evt.button === 1) {
        event.evt.preventDefault();
        beginPan(event.evt.clientX, event.evt.clientY);
        return;
      }

      if (event.evt.button !== 0) {
        return;
      }

      clearGuides();
      if (event.evt.ctrlKey || event.evt.metaKey) {
        setSelection((current) => toggleEntitySelection(current, "wall", wall.id));
        return;
      }

      const baseSelection = isEntitySelected(selectionRef.current, "wall", wall.id)
        ? selectionRef.current
        : selectEntity(planRef.current, "wall", wall.id);
      setSelection(baseSelection);

      if (interactionModeRef.current === "browse") {
        return;
      }

      if (tool !== "select") {
        return;
      }

      const startWorld = resolvePointerWorld(event.evt);
      if (!startWorld) {
        return;
      }

      // 选择模式下按住 Alt 拖动墙体，可直接复制当前结构并拖动新副本。
      if (event.evt.altKey) {
        const duplicated = duplicateSelectionAtSource(planRef.current, baseSelection);
        if (duplicated) {
          clipboardRef.current = duplicated.clipboard;
          pasteCascadeRef.current = 0;
          setHasClipboard(true);
          mutatePlan((draft) => {
            draft.walls.push(...duplicated.pasted.walls);
            draft.cameras.push(...duplicated.pasted.cameras);
          });
          setSelection(duplicated.selection);
          dragSelectionRef.current = buildDragSelectionSnapshot(duplicated.selection, startWorld);
          return;
        }
      }

      dragSelectionRef.current = buildDragSelectionSnapshot(baseSelection, startWorld);
    },
    [beginPan, buildDragSelectionSnapshot, clearGuides, resolvePointerWorld, tool],
  );

  /**
   * 为什么端点 handle 要单独命中圆而不是 Line：
   * 线段的 hitStrokeWidth 已很宽，端点再共用同一区域会难以区分「拖线」还是「拖端点」，小圆把意图拆开。
   */
  const handleWallHandleMouseDown = useCallback(
    (wallId: string, endpoint: "start" | "end", event: KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      if (event.evt.button !== 0) {
        return;
      }
      clearGuides();
      setSelection(createSelection([wallId], []));
      if (interactionModeRef.current === "browse") {
        return;
      }
      const wall = planRef.current.walls.find((item) => item.id === wallId);
      if (!wall) {
        return;
      }
      dragWallHandleRef.current = {
        wallId,
        endpoint,
        moved: false,
        anchor:
          endpoint === "start"
            ? { x: wall.x2, y: wall.y2 }
            : { x: wall.x1, y: wall.y1 },
      };
    },
    [clearGuides],
  );

  /**
   * 为什么网格线只生成视口附近一段：
   * 全图画满网格在万级线段时拖慢帧率；按视口裁剪后仍保持视觉无限网格，因为世界坐标系未变。
   */
  const gridLines = useMemo(() => {
    const left = clamp((-plan.view.x) / plan.view.scale, 0, FLOOR_PLAN_WORLD_WIDTH);
    const top = clamp((-plan.view.y) / plan.view.scale, 0, FLOOR_PLAN_WORLD_HEIGHT);
    const right = clamp(
      (viewportSize.width - plan.view.x) / plan.view.scale,
      0,
      FLOOR_PLAN_WORLD_WIDTH,
    );
    const bottom = clamp(
      (viewportSize.height - plan.view.y) / plan.view.scale,
      0,
      FLOOR_PLAN_WORLD_HEIGHT,
    );

    const lines: Array<{
      key: string;
      points: number[];
      major: boolean;
    }> = [];

    const startColumn = Math.max(0, Math.floor(left / FLOOR_PLAN_GRID_SIZE) - 2);
    const endColumn = Math.min(
      Math.ceil(FLOOR_PLAN_WORLD_WIDTH / FLOOR_PLAN_GRID_SIZE),
      Math.ceil(right / FLOOR_PLAN_GRID_SIZE) + 2,
    );
    const startRow = Math.max(0, Math.floor(top / FLOOR_PLAN_GRID_SIZE) - 2);
    const endRow = Math.min(
      Math.ceil(FLOOR_PLAN_WORLD_HEIGHT / FLOOR_PLAN_GRID_SIZE),
      Math.ceil(bottom / FLOOR_PLAN_GRID_SIZE) + 2,
    );

    for (let column = startColumn; column <= endColumn; column += 1) {
      const x = column * FLOOR_PLAN_GRID_SIZE;
      lines.push({
        key: `vx-${x}`,
        points: [x, 0, x, FLOOR_PLAN_WORLD_HEIGHT],
        major: column % 5 === 0,
      });
    }

    for (let row = startRow; row <= endRow; row += 1) {
      const y = row * FLOOR_PLAN_GRID_SIZE;
      lines.push({
        key: `hy-${y}`,
        points: [0, y, FLOOR_PLAN_WORLD_WIDTH, y],
        major: row % 5 === 0,
      });
    }

    return lines;
  }, [plan.view.scale, plan.view.x, plan.view.y, viewportSize.height, viewportSize.width]);

  void historyVersion;

  /**
   * 为什么按模式/可用性隐藏按钮而不是统一置灰：
   * 浏览态下大量永不可点的控件只会挤占注意力并让人反复尝试点击；编辑态下随选择动态出现的「撤销/编组」等若常驻禁用，同样像在展示残缺功能。只渲染当前有意义的控件，信息密度更接近用户此刻能做的事。
   */
  const isBrowseMode = interactionMode === "browse";
  const isEditMode = interactionMode === "edit";
  const showEditToolButtons = isEditMode;
  const showUndoRedo =
    isEditMode && (canUndo || canRedo);
  const showClipboardGroup =
    isEditMode &&
    (canCopySelection || hasClipboard || canGroup || canUngroup);

  return (
    <div className="flex h-full min-h-screen bg-[#f5f7fb] text-gray-900">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white/95 p-2 shadow-sm backdrop-blur">
          <ToolbarButton title={t("dataflow")} onClick={() => onViewModeChange("dataflow")}>
            <Layers className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton active title={t("floor_plan_mode")} onClick={() => onViewModeChange("2d")}>
            <MapIcon className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-6 w-px bg-gray-200" />
          <ToolbarButton
            active={interactionMode === "browse"}
            title={t("browse_mode")}
            onClick={() => setInteractionMode("browse")}
          >
            <Eye className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={interactionMode === "edit"}
            title={t("edit_mode")}
            onClick={() => setInteractionMode("edit")}
          >
            <Pencil className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title={t("floor_plan_help_tooltip")} onClick={() => setGuideModalOpen(true)}>
            <MapPinned className="h-4 w-4" />
          </ToolbarButton>
          {showEditToolButtons ? (
            <>
              <div className="mx-1 h-6 w-px bg-gray-200" />
              <ToolbarButton
                active={tool === "select"}
                title={t("select_tool")}
                onClick={() => setTool("select")}
              >
                <MousePointer2 className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton active={tool === "wall"} title={t("wall_tool")} onClick={() => setTool("wall")}>
                <Waypoints className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton active={tool === "room"} title={t("room_tool")} onClick={() => setTool("room")}>
                <Square className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton active={tool === "camera"} title={t("camera_tool")} onClick={() => setTool("camera")}>
                <Camera className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton active={tool === "pan"} title={t("pan_tool")} onClick={() => setTool("pan")}>
                <Hand className="h-4 w-4" />
              </ToolbarButton>
            </>
          ) : null}
          {showUndoRedo ? (
            <>
              <div className="mx-1 h-6 w-px bg-gray-200" />
              {canUndo ? (
                <ToolbarButton title={t("undo")} onClick={undo}>
                  <Undo2 className="h-4 w-4" />
                </ToolbarButton>
              ) : null}
              {canRedo ? (
                <ToolbarButton title={t("redo")} onClick={redo}>
                  <Redo2 className="h-4 w-4" />
                </ToolbarButton>
              ) : null}
            </>
          ) : null}
          {showClipboardGroup ? (
            <>
              <div className="mx-1 h-6 w-px bg-gray-200" />
              {canCopySelection ? (
                <CompactActionButton onClick={copySelection}>{t("copy_selection")}</CompactActionButton>
              ) : null}
              {hasClipboard ? (
                <CompactActionButton onClick={() => pasteClipboard()}>{t("paste_selection")}</CompactActionButton>
              ) : null}
              {canCopySelection ? (
                <CompactActionButton onClick={duplicateSelection}>{t("duplicate_selection")}</CompactActionButton>
              ) : null}
              {canGroup ? (
                <CompactActionButton onClick={groupSelection}>{t("group_selection")}</CompactActionButton>
              ) : null}
              {canUngroup ? (
                <CompactActionButton onClick={ungroupSelection}>{t("ungroup_selection")}</CompactActionButton>
              ) : null}
            </>
          ) : null}
          <div className="mx-1 h-6 w-px bg-gray-200" />
          <ToolbarButton
            title={t("zoom_out")}
            onClick={() =>
              replacePlan(
                {
                  ...plan,
                  view: {
                    ...plan.view,
                    scale: clamp(plan.view.scale - 0.15, 0.35, 3.2),
                  },
                },
                false,
              )
            }
          >
            <ZoomOut className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title={t("zoom_in")}
            onClick={() =>
              replacePlan(
                {
                  ...plan,
                  view: {
                    ...plan.view,
                    scale: clamp(plan.view.scale + 0.15, 0.35, 3.2),
                  },
                },
                false,
              )
            }
          >
            <ZoomIn className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title={t("zoom_to_fit")} onClick={zoomToFit}>
            <WandSparkles className="h-4 w-4" />
          </ToolbarButton>
          {boundCamerasForOverview.length > 0 ? (
            <ToolbarButton title={t("zoom_to_fit_cameras")} onClick={() => zoomToFitCameras(boundCamerasForOverview)}>
              <Focus className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
          {selectedPlaybackTo && selectedAlertsTo ? (
            <>
              <div className="mx-1 h-6 w-px bg-gray-200" />
              <Link
                to={selectedPlaybackTo}
                title={t("open_playback")}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
              <Link
                to={selectedAlertsTo}
                title={t("open_alerts")}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-800 transition-colors hover:bg-amber-100"
              >
                <Bell className="h-4 w-4" />
              </Link>
            </>
          ) : null}
          {isEditMode ? (
            <ToolbarButton
              title={t("reset_layout")}
              onClick={() => {
                clearFloorPlanState();
                const next = createDefaultFloorPlanState();
                historyRef.current = [cloneFloorPlanState(next)];
                historyIndexRef.current = 0;
                setHistoryVersion((value) => value + 1);
                setSelection(null);
                setWallPreview(null);
                setRoomPreview(null);
                wallDrawRef.current = null;
                roomDrawRef.current = null;
                dragSelectionRef.current = null;
                dragWallHandleRef.current = null;
                clearGuides();
                replacePlan(next, false);
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
        </div>

        <Modal
          open={guideModalOpen}
          title={t("floor_plan_guide_title")}
          onCancel={() => {
            setGuideModalOpen(false);
            saveFloorPlanGuideDismissed();
          }}
          footer={
            <Button
              type="primary"
              onClick={() => {
                setGuideModalOpen(false);
                saveFloorPlanGuideDismissed();
              }}
            >
              {t("floor_plan_guide_ok")}
            </Button>
          }
        >
          <div className="space-y-3 text-sm text-gray-600">
            <p>{t("floor_plan_guide_browse_edit")}</p>
            <p>{t("floor_plan_guide_filter_nav")}</p>
            <p>{t("floor_plan_guide_event_refresh")}</p>
            <p>{t("floor_plan_guide_minimap")}</p>
            <p className="text-xs text-gray-400">{t("floor_plan_guide_storage_note")}</p>
          </div>
        </Modal>

        <div className="absolute bottom-4 left-4 z-20 max-w-4xl rounded-xl border border-gray-200 bg-white/95 px-4 py-2 text-xs text-gray-600 shadow-sm backdrop-blur">
          {interactionMode === "browse"
            ? t("browse_mode_hint")
            : `${toolHint(tool, t)} · ${t("middle_pan_hint")} · ${t("wheel_pinch_zoom_hint")} · ${t("multi_select_hint")} · ${t("box_select_hint")} · ${t("shift_drag_hint")} · ${t("alt_drag_hint")} · ${t("select_all_hint")} · ${t("copy_paste_hint")} · ${t("preset_hint")}`}
        </div>

        <div ref={containerRef} className="relative flex-1 overflow-hidden select-none">
          <Stage
            width={viewportSize.width}
            height={viewportSize.height}
            onMouseDown={handleStageMouseDown}
            onContextMenu={(event) => {
              event.evt.preventDefault();
            }}
          >
            <Layer listening={false}>
              <Rect x={0} y={0} width={viewportSize.width} height={viewportSize.height} fill="#f8fafc" />
            </Layer>

            <Layer>
              <Group x={plan.view.x} y={plan.view.y} scaleX={plan.view.scale} scaleY={plan.view.scale}>
                <Rect
                  x={0}
                  y={0}
                  width={FLOOR_PLAN_WORLD_WIDTH}
                  height={FLOOR_PLAN_WORLD_HEIGHT}
                  fill="#ffffff"
                  cornerRadius={20}
                  shadowBlur={6}
                  shadowOpacity={0.04}
                  listening={false}
                />

                {gridLines.map((line) => (
                  <Line
                    key={line.key}
                    points={line.points}
                    stroke={line.major ? "#d9e0ea" : "#edf2f7"}
                    strokeWidth={1}
                    listening={false}
                  />
                ))}

                {alignmentGuides.vertical.map((x) => (
                  <Line
                    key={`guide-v-${x}`}
                    points={[x, 0, x, FLOOR_PLAN_WORLD_HEIGHT]}
                    stroke="#14b8a6"
                    strokeWidth={2}
                    dash={[12, 8]}
                    listening={false}
                  />
                ))}
                {alignmentGuides.horizontal.map((y) => (
                  <Line
                    key={`guide-h-${y}`}
                    points={[0, y, FLOOR_PLAN_WORLD_WIDTH, y]}
                    stroke="#14b8a6"
                    strokeWidth={2}
                    dash={[12, 8]}
                    listening={false}
                  />
                ))}

                {roomPreview ? (
                  <Rect
                    x={normalizeRect(roomPreview.start, roomPreview.end).x}
                    y={normalizeRect(roomPreview.start, roomPreview.end).y}
                    width={normalizeRect(roomPreview.start, roomPreview.end).width}
                    height={normalizeRect(roomPreview.start, roomPreview.end).height}
                    dash={[16, 10]}
                    fill="#60a5fa22"
                    stroke="#60a5fa"
                    strokeWidth={4}
                    listening={false}
                  />
                ) : null}

                {wallPreview ? (
                  <Line
                    points={[
                      wallPreview.start.x,
                      wallPreview.start.y,
                      wallPreview.end.x,
                      wallPreview.end.y,
                    ]}
                    stroke="#60a5fa"
                    strokeWidth={4}
                    dash={[16, 10]}
                    lineCap="round"
                    listening={false}
                  />
                ) : null}

                {marqueeRect ? (
                  <Rect
                    x={marqueeRect.x}
                    y={marqueeRect.y}
                    width={marqueeRect.width}
                    height={marqueeRect.height}
                    fill="#2563eb22"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dash={[12, 8]}
                    listening={false}
                  />
                ) : null}

                {plan.walls.map((wall) => {
                  const isSelected = isEntitySelected(selection, "wall", wall.id);
                  return (
                    <Group key={wall.id}>
                      <Line
                        points={[wall.x1, wall.y1, wall.x2, wall.y2]}
                        stroke={isSelected ? "#2563eb" : wall.groupId ? "#1f2937" : "#111827"}
                        strokeWidth={isSelected ? 12 : 10}
                        hitStrokeWidth={26}
                        lineCap="round"
                        onMouseDown={(event) => handleWallMouseDown(wall, event)}
                      />

                      {isSelected && selectedWallCount === 1 && selectedCameraCount === 0 ? (
                        <>
                          <Circle
                            x={wall.x1}
                            y={wall.y1}
                            radius={9}
                            fill="#ffffff"
                            stroke="#2563eb"
                            strokeWidth={3}
                            onMouseDown={(event) =>
                              handleWallHandleMouseDown(wall.id, "start", event)
                            }
                          />
                          <Circle
                            x={wall.x2}
                            y={wall.y2}
                            radius={9}
                            fill="#ffffff"
                            stroke="#2563eb"
                            strokeWidth={3}
                            onMouseDown={(event) =>
                              handleWallHandleMouseDown(wall.id, "end", event)
                            }
                          />
                        </>
                      ) : null}
                    </Group>
                  );
                })}

                {plan.cameras.map((camera) => {
                  const isSelected = isEntitySelected(selection, "camera", camera.id);
                  const matchesFilter = cameraMatchesFilter(camera);
                  const hasRecentEvent = Boolean(camera.latestEventAt);
                  const accent = camera.channelId ? (hasRecentEvent ? "#f97316" : "#2563eb") : "#9ca3af";
                  const facingX = camera.x + Math.cos((camera.angle * Math.PI) / 180) * 34;
                  const facingY = camera.y + Math.sin((camera.angle * Math.PI) / 180) * 34;
                  const onlineKnown =
                    camera.channelId != null && channelOnlineById.has(camera.channelId);
                  const isChannelOnline = camera.channelId
                    ? channelOnlineById.get(camera.channelId)
                    : undefined;
                  const ringStroke =
                    !camera.channelId
                      ? "#ffffff"
                      : !onlineKnown
                        ? "#e2e8f0"
                        : isChannelOnline
                          ? "#22c55e"
                          : "#ef4444";

                  return (
                    <Group
                      key={camera.id}
                      opacity={matchesFilter ? 1 : 0.22}
                      onMouseEnter={() => {
                        if (!matchesFilter) {
                          return;
                        }
                        cancelHoverClear();
                        setHoveredCameraId(camera.id);
                        void loadHoverEvent(camera);
                      }}
                      onMouseLeave={() => {
                        if (!matchesFilter) {
                          return;
                        }
                        scheduleHoverClear();
                      }}
                    >
                      <Line
                        points={createSectorPoints(camera)}
                        closed
                        fill={accent}
                        opacity={0.14}
                        stroke={accent}
                        strokeWidth={2}
                        listening={false}
                      />
                      <Line
                        points={[camera.x, camera.y, facingX, facingY]}
                        stroke={accent}
                        strokeWidth={3}
                        listening={false}
                      />
                      <Circle
                        x={camera.x}
                        y={camera.y}
                        radius={isSelected ? 15 : 12}
                        fill={accent}
                        stroke={isSelected ? "#111827" : ringStroke}
                        strokeWidth={isSelected ? 3 : onlineKnown ? 4 : 3}
                        onMouseDown={(event) => handleCameraMouseDown(camera.id, event)}
                      />
                      <Text
                        x={camera.x + 18}
                        y={camera.y - 16}
                        text={camera.channelName || t("camera_label")}
                        fill="#334155"
                        fontSize={18}
                        fontStyle="bold"
                        listening={false}
                      />
                    </Group>
                  );
                })}
              </Group>
            </Layer>
          </Stage>

          {hoveredCamera && hoveredCameraScreenPosition && cameraMatchesFilter(hoveredCamera) ? (
            <CameraHoverCard
              camera={hoveredCamera}
              latestEvent={hoverEvent}
              loading={hoverLoading}
              anchorX={hoveredCameraScreenPosition.x}
              anchorY={hoveredCameraScreenPosition.y}
              canvasContainerRef={containerRef}
              onCardPointerEnter={cancelHoverClear}
              onCardPointerLeave={scheduleHoverClear}
              channelOnline={
                hoveredCamera.channelId != null
                  ? channelOnlineById.has(hoveredCamera.channelId)
                    ? channelOnlineById.get(hoveredCamera.channelId)
                    : undefined
                  : null
              }
              playbackTo={
                hoveredCamera.channelId
                  ? buildPlaybackDetailTo(hoveredCamera.channelId)
                  : null
              }
              alertsTo={
                hoveredCamera.channelId ? buildAlertsTo(hoveredCamera.channelId) : null
              }
              eventOccurredAgo={hoverCardEventAgo}
              dataFetchedAgo={hoverLoading ? "" : hoverCardDataAgo}
            />
          ) : null}

          <FloorPlanMinimap
            walls={plan.walls}
            cameras={plan.cameras}
            view={plan.view}
            viewportWidth={viewportSize.width}
            viewportHeight={viewportSize.height}
            onCenterWorld={centerViewOnWorld}
          />
        </div>
      </div>

      <aside className="w-[340px] shrink-0 border-l border-gray-200 bg-white/90 p-4 backdrop-blur">
        <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 text-sm font-semibold text-gray-900">{t("planner_overview")}</div>
          <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <div className="text-xs text-gray-500">{t("wall_count")}</div>
              <div className="mt-1 text-xl font-semibold text-gray-900">{plan.walls.length}</div>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <div className="text-xs text-gray-500">{t("camera_count")}</div>
              <div className="mt-1 text-xl font-semibold text-gray-900">{plan.cameras.length}</div>
            </div>
            <div className="col-span-2 rounded-xl bg-white p-3 shadow-sm text-xs text-gray-500">
              {t("current_scale")}: {(plan.view.scale * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {isEditMode ? (
          <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <LayoutTemplate className="h-4 w-4" />
              {t("preset_shapes")}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <PresetButton label={t("preset_small_room")} onClick={() => insertPreset("small_room")} />
              <PresetButton label={t("preset_corridor")} onClick={() => insertPreset("corridor")} />
              <div className="col-span-2">
                <PresetButton label={t("preset_l_room")} onClick={() => insertPreset("l_room")} />
              </div>
            </div>
            <div className="mt-3 text-xs leading-5 text-gray-500">{t("preset_description")}</div>
          </div>
        ) : null}

        <CameraBindingPanel
          camera={selectedCamera}
          channelOptions={channelOptions}
          channelsLoading={channelQuery.isLoading}
          channelsError={channelQuery.isError ? String(channelQuery.error) : null}
          interactionMode={interactionMode}
          channelFilter={channelNameFilter}
          onChannelFilterChange={setChannelNameFilter}
          selectedLatestEvent={panelLatestEvent}
          selectedEventLoading={panelEventLoading}
          channelOnline={selectedChannelOnline}
          playbackTo={
            selectedCamera?.channelId ? buildPlaybackDetailTo(selectedCamera.channelId) : null
          }
          alertsTo={
            selectedCamera?.channelId ? buildAlertsTo(selectedCamera.channelId) : null
          }
          eventOccurredAgo={panelEventOccurredAgo}
          dataFetchedAgo={panelDataFetchedAgo}
          onRefreshEvent={selectedCamera?.channelId ? refreshPanelEvent : undefined}
          filterMatchCount={filterMatches.length}
          filterMatchActiveIndex={filterMatchIndex}
          onFilterPrev={() => navigateFilterMatch(-1)}
          onFilterNext={() => navigateFilterMatch(1)}
          onFilterFrameAll={frameFilterMatches}
          onBindChannel={(channelId) => {
            updateSelectedCamera((camera) => {
              const option = channelOptions.find((item) => item.value === channelId);
              camera.channelId = channelId;
              camera.channelName = option?.channelName ?? null;
              camera.deviceName = option?.deviceName ?? null;
            });
          }}
          onAngleChange={(value) =>
            updateSelectedCamera((camera) => {
              camera.angle = value;
            })
          }
          onFovChange={(value) =>
            updateSelectedCamera((camera) => {
              camera.fov = value;
            })
          }
          onRangeChange={(value) =>
            updateSelectedCamera((camera) => {
              camera.range = value;
            })
          }
          onDelete={deleteSelection}
        />

        {isBatchSelection ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <div className="mb-1 font-medium text-gray-900">{t("batch_selected")}</div>
            <div className="mb-2 text-xs text-gray-500">
              {t("batch_selected_summary", {
                walls: selectedWallCount,
                cameras: selectedCameraCount,
              })}
            </div>
            <div className="mb-3 text-xs leading-5 text-gray-500">
              {selectedGroupIds.length > 0 ? t("grouped_selection_hint") : t("multi_select_hint")}
            </div>
            {isBrowseMode ? (
              <div className="text-xs leading-5 text-gray-500">{t("browse_side_actions_hidden_hint")}</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {canGroup ? (
                  <button
                    type="button"
                    onClick={groupSelection}
                    className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800"
                  >
                    {t("group_selection")}
                  </button>
                ) : null}
                {canUngroup ? (
                  <button
                    type="button"
                    onClick={ungroupSelection}
                    className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                  >
                    {t("ungroup_selection")}
                  </button>
                ) : null}
                {canCopySelection ? (
                  <button
                    type="button"
                    onClick={copySelection}
                    className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                  >
                    {t("copy_selection")}
                  </button>
                ) : null}
                {canCopySelection ? (
                  <button
                    type="button"
                    onClick={duplicateSelection}
                    className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                  >
                    {t("duplicate_selection")}
                  </button>
                ) : null}
                {hasClipboard ? (
                  <button
                    type="button"
                    onClick={() => pasteClipboard()}
                    className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                  >
                    {t("paste_selection")}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={deleteSelection}
                  className="rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-600"
                >
                  {t("delete_selected")}
                </button>
              </div>
            )}
          </div>
        ) : selectedCamera ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
            <div className="mb-1 font-medium text-gray-900">{t("camera_summary")}</div>
            <div>
              {t("direction")}: {formatAngle(selectedCamera.angle)}
            </div>
            <div>
              {t("fov")}: {Math.round(selectedCamera.fov)}°
            </div>
            <div>
              {t("range")}: {Math.round(selectedCamera.range)}
            </div>
            <div className="mt-2 text-[11px] text-gray-500">
              {selectedCamera.groupId ? t("grouped_item_hint") : t("single_item_hint")}
            </div>
          </div>
        ) : selectedWall ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <div className="mb-1 font-medium text-gray-900">{t("wall_selected")}</div>
            <div className="mb-2 text-xs text-gray-500">#{selectedWall.id}</div>
            {isEditMode ? (
              <div className="mb-3 text-xs leading-5 text-gray-500">{t("wall_edit_tip")}</div>
            ) : null}
            <div className="mb-3 text-[11px] leading-5 text-gray-500">
              {selectedWall.groupId ? t("grouped_item_hint") : t("single_item_hint")}
            </div>
            {isBrowseMode ? (
              <div className="text-xs leading-5 text-gray-500">{t("browse_side_actions_hidden_hint")}</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={copySelection}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
                  >
                    {t("copy_selection")}
                  </button>
                  <button
                    type="button"
                    onClick={duplicateSelection}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
                  >
                    {t("duplicate_selection")}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={deleteSelection}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
                >
                  {t("delete_wall")}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("selection_empty_description_v3")} />
          </div>
        )}
      </aside>
    </div>
  );
}
