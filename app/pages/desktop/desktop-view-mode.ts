export const DESKTOP_VIEW_MODE_KEY = "desktop-view-mode";

export type DesktopViewMode = "dataflow" | "2d";

/**
 * 为什么视图模式单独持久化：
 * 用户常在拓扑与 2D 间切换，刷新后回到默认数据流会增加操作步数；与平面图内容解耦避免撤销栈牵连。
 */
export function loadDesktopViewMode(): DesktopViewMode | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(DESKTOP_VIEW_MODE_KEY);
    if (raw === "dataflow" || raw === "2d") {
      return raw;
    }
  } catch (error) {
    console.warn("[desktop] failed to read view mode", error);
  }
  return null;
}

export function saveDesktopViewMode(mode: DesktopViewMode) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(DESKTOP_VIEW_MODE_KEY, mode);
  } catch (error) {
    console.warn("[desktop] failed to save view mode", error);
  }
}
