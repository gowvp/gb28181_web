import type { FloorPlanState } from "./floor_plan.types";
import { normalizeFloorPlanState } from "./floor_plan.storage";

export const FLOOR_PLAN_EXPORT_WRAPPER_VERSION = 1;

export type FloorPlanExportFile = {
  exportVersion: typeof FLOOR_PLAN_EXPORT_WRAPPER_VERSION;
  exportedAt: number;
  floorPlan: FloorPlanState;
};

/**
 * 为什么导出包一层元数据：
 * 纯文件备份需要可辨别的版本与时间，便于同事对照与排障；内层仍必须是可 `normalizeFloorPlanState` 的 v3 结构，导入时与 localStorage 共用同一套归一化。
 */
export function buildFloorPlanExportPayload(state: FloorPlanState): FloorPlanExportFile {
  return {
    exportVersion: FLOOR_PLAN_EXPORT_WRAPPER_VERSION,
    exportedAt: Date.now(),
    floorPlan: normalizeFloorPlanState(state),
  };
}

/**
 * 为什么导入要兼容「裸 FloorPlanState」：
 * 早期或手工编辑的 JSON 可能没有 wrapper；只要 `version === 3` 且结构可解析就允许导入，减少备份恢复时的摩擦。
 */
export function parseFloorPlanImportJson(text: string): FloorPlanState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error("INVALID_JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("EMPTY");
  }

  const record = parsed as Record<string, unknown>;
  const inner =
    record.floorPlan && typeof record.floorPlan === "object"
      ? record.floorPlan
      : record.version === 3
        ? parsed
        : null;

  if (!inner) {
    throw new Error("NO_FLOOR_PLAN");
  }

  const normalized = normalizeFloorPlanState(inner);
  if (normalized.version !== 3) {
    throw new Error("BAD_VERSION");
  }
  return normalized;
}
