/**
 * 为什么绝对时间仍保留：
 * 相对时间适合扫读，对账与排障仍要精确到点；非法时间戳在 UI 降级为字符串，避免整段面板被 ErrorBoundary 卸掉。
 */
export function formatEventTimeAbsolute(timestamp: number | null | undefined) {
  if (!timestamp) {
    return "-";
  }
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return String(timestamp);
  }
}

/**
 * 为什么相对时间用「与 now 的差值」：
 * 运维扫一眼更关心「多久前出的警」或「数据多久前拉过」；绝对时间仍保留在详情行里。定时 tick 由父组件控制，避免每张卡片各自 setInterval。
 */
export function formatTimeAgoFromMs(
  pastMs: number | null | undefined,
  nowMs: number,
  t: (key: string, options?: Record<string, string | number>) => string,
): string {
  if (!pastMs || !Number.isFinite(pastMs)) {
    return "";
  }
  const sec = Math.max(0, Math.floor((nowMs - pastMs) / 1000));
  if (sec < 45) {
    return t("event_time_relative_just");
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return t("event_time_relative_minutes", { count: min });
  }
  const hr = Math.floor(min / 60);
  if (hr < 48) {
    return t("event_time_relative_hours", { count: hr });
  }
  const day = Math.floor(hr / 24);
  return t("event_time_relative_days", { count: day });
}
