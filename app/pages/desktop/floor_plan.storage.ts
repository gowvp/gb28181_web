import type { CameraMarker, FloorPlanState, PlannerPoint } from "./floor_plan.types";

export const FLOOR_PLAN_STORAGE_KEY = "desktop-floor-plan-v2";
export const FLOOR_PLAN_GRID_SIZE = 40;
export const FLOOR_PLAN_WORLD_WIDTH = 3200;
export const FLOOR_PLAN_WORLD_HEIGHT = 2000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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

export function cloneFloorPlanState(state: FloorPlanState): FloorPlanState {
  return JSON.parse(JSON.stringify(state)) as FloorPlanState;
}

export function normalizeFloorPlanState(input: unknown): FloorPlanState {
  const fallback = createDefaultFloorPlanState();
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const value = input as Partial<FloorPlanState>;

  return {
    version: 3,
    walls: Array.isArray(value.walls)
      ? value.walls
          .filter((wall) => wall && typeof wall.id === "string")
          .map((wall) => ({
            id: wall.id,
            x1: Number.isFinite(wall.x1) ? wall.x1 : 0,
            y1: Number.isFinite(wall.y1) ? wall.y1 : 0,
            x2: Number.isFinite(wall.x2) ? wall.x2 : 0,
            y2: Number.isFinite(wall.y2) ? wall.y2 : 0,
            groupId: wall.groupId ?? null,
          }))
      : [],
    cameras: Array.isArray(value.cameras)
      ? value.cameras
          .filter((camera) => camera && typeof camera.id === "string")
          .map((camera) => ({
            id: camera.id,
            x: Number.isFinite(camera.x) ? camera.x : 0,
            y: Number.isFinite(camera.y) ? camera.y : 0,
            angle: Number.isFinite(camera.angle) ? camera.angle : 0,
            fov: clamp(Number.isFinite(camera.fov) ? camera.fov : 70, 20, 160),
            range: clamp(Number.isFinite(camera.range) ? camera.range : 260, 80, 800),
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
      x: Number.isFinite(value.view?.x) ? value.view.x : fallback.view.x,
      y: Number.isFinite(value.view?.y) ? value.view.y : fallback.view.y,
      scale: clamp(
        Number.isFinite(value.view?.scale) ? value.view.scale : fallback.view.scale,
        0.35,
        3.2,
      ),
    },
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now(),
  };
}

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
  } catch {
    return null;
  }
}

export function saveFloorPlanState(state: FloorPlanState) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    FLOOR_PLAN_STORAGE_KEY,
    JSON.stringify(normalizeFloorPlanState(state)),
  );
}

export function clearFloorPlanState() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(FLOOR_PLAN_STORAGE_KEY);
}
