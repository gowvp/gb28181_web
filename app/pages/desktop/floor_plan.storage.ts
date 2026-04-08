import type { CameraMarker, FloorPlanState, PlannerPoint } from "./floor_plan.types";

export const FLOOR_PLAN_STORAGE_KEY = "desktop-floor-plan-v2";
export const FLOOR_PLAN_GRID_SIZE = 40;
export const FLOOR_PLAN_WORLD_WIDTH = 3200;
export const FLOOR_PLAN_WORLD_HEIGHT = 2000;

/**
 * 为什么单独抽出数值归一化：
 * 本地存储里的旧布局可能来自不同版本，直接在读取点散落做判断既容易漏掉边界，
 * 也会让 TypeScript 无法稳定收窄类型。统一走这里可以同时保证编译安全和历史数据兼容。
 */
function normalizeFiniteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * 为什么保留 clamp 而不是在每个字段手写上下限：
 * 平面图状态会被拖动、缩放、历史记录和 localStorage 反复读写，集中裁剪范围可以避免异常数据持续污染后续状态。
 */
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * 为什么在创建摄像头时一次性补齐默认字段：
 * 编辑器里很多交互会直接读取事件预览、绑定信息和分组信息，提前补齐空值能避免后续流程到处写防御分支。
 */
export function createCameraMarker(point: PlannerPoint): CameraMarker {
  return {
    id: `camera-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    x: point.x,
    y: point.y,
    angle: 0,
    fov: 70,
    range: 260,
    channelId: null,
    channelName: null,
    groupId: null,
    deviceName: null,
    latestEventAt: null,
    latestEventImage: null,
    latestEventLabel: null,
    latestEventScore: null,
  };
}

/**
 * 为什么给默认视口一个非零偏移：
 * 首次进入时把内容完全贴在左上角会让用户误以为没有留出编辑空间，轻微留白能更快建立可编辑区域的感知。
 */
export function createDefaultFloorPlanState(): FloorPlanState {
  return {
    version: 3,
    walls: [],
    cameras: [],
    view: {
      x: 120,
      y: 80,
      scale: 1,
    },
    updatedAt: Date.now(),
  };
}

/**
 * 为什么继续使用 JSON 深拷贝：
 * 这里的数据模型只包含可序列化的 plain object，保持和历史快照、撤销栈、localStorage 同一种表达方式最不容易引入副作用。
 */
export function cloneFloorPlanState(state: FloorPlanState): FloorPlanState {
  return JSON.parse(JSON.stringify(state)) as FloorPlanState;
}

/**
 * 为什么读取布局时做强归一化：
 * 平面图状态会跨版本保存在浏览器里，任何一次字段变更都可能把旧数据带进新逻辑。
 * 在入口统一修正能把问题截断在恢复阶段，避免编辑器运行到一半才暴露异常。
 */
export function normalizeFloorPlanState(input: unknown): FloorPlanState {
  const fallback = createDefaultFloorPlanState();
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const value = input as Partial<FloorPlanState>;
  const rawView = value.view && typeof value.view === "object" ? value.view : undefined;

  return {
    version: 3,
    walls: Array.isArray(value.walls)
      ? value.walls
          .filter((wall) => wall && typeof wall.id === "string")
          .map((wall) => ({
            id: wall.id,
            x1: normalizeFiniteNumber(wall.x1, 0),
            y1: normalizeFiniteNumber(wall.y1, 0),
            x2: normalizeFiniteNumber(wall.x2, 0),
            y2: normalizeFiniteNumber(wall.y2, 0),
            groupId: wall.groupId ?? null,
          }))
      : [],
    cameras: Array.isArray(value.cameras)
      ? value.cameras
          .filter((camera) => camera && typeof camera.id === "string")
          .map((camera) => ({
            id: camera.id,
            x: normalizeFiniteNumber(camera.x, 0),
            y: normalizeFiniteNumber(camera.y, 0),
            angle: normalizeFiniteNumber(camera.angle, 0),
            fov: clamp(normalizeFiniteNumber(camera.fov, 70), 20, 160),
            range: clamp(normalizeFiniteNumber(camera.range, 260), 80, 800),
            channelId: camera.channelId ?? null,
            channelName: camera.channelName ?? null,
            groupId: camera.groupId ?? null,
            deviceName: camera.deviceName ?? null,
            latestEventAt: camera.latestEventAt ?? null,
            latestEventImage: camera.latestEventImage ?? null,
            latestEventLabel: camera.latestEventLabel ?? null,
            latestEventScore: camera.latestEventScore ?? null,
          }))
      : [],
    view: {
      x: normalizeFiniteNumber(rawView?.x, fallback.view.x),
      y: normalizeFiniteNumber(rawView?.y, fallback.view.y),
      scale: clamp(normalizeFiniteNumber(rawView?.scale, fallback.view.scale), 0.35, 3.2),
    },
    updatedAt: normalizeFiniteNumber(value.updatedAt, Date.now()),
  };
}

/**
 * 为什么读取失败时选择降级而不是抛错：
 * 布局恢复属于增强体验，不能因为单个损坏缓存阻塞整个桌面页；同时输出告警，方便后续定位是哪份缓存出了问题。
 */
export function loadFloorPlanState(): FloorPlanState | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(FLOOR_PLAN_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return normalizeFloorPlanState(JSON.parse(raw));
  } catch (error) {
    console.warn("[floor-plan] failed to load saved layout", error);
    return null;
  }
}

/**
 * 为什么保存前再次归一化：
 * 编辑态里可能存在来自拖拽中的中间值或旧版本字段，写入前统一清洗可以让后续恢复链路始终面对稳定数据。
 */
export function saveFloorPlanState(state: FloorPlanState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      FLOOR_PLAN_STORAGE_KEY,
      JSON.stringify(normalizeFloorPlanState(state)),
    );
  } catch (error) {
    console.warn("[floor-plan] failed to save layout", error);
  }
}

/**
 * 为什么保留独立清理入口：
 * 当布局结构升级或缓存异常时，需要一个可复用的单点出口，避免不同交互各自删除缓存导致行为不一致。
 */
export function clearFloorPlanState() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(FLOOR_PLAN_STORAGE_KEY);
}

export const FLOOR_PLAN_INTERACTION_MODE_KEY = "desktop-floor-plan-interaction-mode";

export type FloorPlanInteractionMode = "browse" | "edit";

/**
 * 为什么浏览/编辑模式单独 key 而不塞进 FloorPlanState：
 * 这是壳层交互偏好，与画布几何无关；写进 plan 会让撤销栈与导出混淆，且用户期望「切回编辑」不撤销。
 */
export function loadFloorPlanInteractionMode(): FloorPlanInteractionMode {
  if (typeof window === "undefined") {
    return "edit";
  }
  try {
    const raw = window.localStorage.getItem(FLOOR_PLAN_INTERACTION_MODE_KEY);
    if (raw === "browse" || raw === "edit") {
      return raw;
    }
  } catch (error) {
    console.warn("[floor-plan] failed to read interaction mode", error);
  }
  return "edit";
}

export function saveFloorPlanInteractionMode(mode: FloorPlanInteractionMode) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(FLOOR_PLAN_INTERACTION_MODE_KEY, mode);
  } catch (error) {
    console.warn("[floor-plan] failed to save interaction mode", error);
  }
}

export const FLOOR_PLAN_GUIDE_DISMISSED_KEY = "desktop-floor-plan-guide-dismissed";

/**
 * 为什么首次引导单独持久化：
 * 与平面图 JSON 无关，只表示用户已读过说明；放进 plan 会随撤销/清空布局误删提示状态，独立 key 更稳。
 */
export function loadFloorPlanGuideDismissed(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    return window.localStorage.getItem(FLOOR_PLAN_GUIDE_DISMISSED_KEY) === "1";
  } catch (error) {
    console.warn("[floor-plan] failed to read guide dismissed flag", error);
    return true;
  }
}

export function saveFloorPlanGuideDismissed() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(FLOOR_PLAN_GUIDE_DISMISSED_KEY, "1");
  } catch (error) {
    console.warn("[floor-plan] failed to save guide dismissed flag", error);
  }
}
