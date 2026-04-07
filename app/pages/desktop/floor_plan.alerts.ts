/**
 * 为什么告警页用 query 而不是路径参数：
 * 告警列表已有通道下拉筛选，与 `cid` 查询参数对齐只需初始化 `selectedChannel`，无需新增路由形态或后端改动。
 */
export function buildAlertsHref(channelId: string): string {
  return `/alerts?cid=${encodeURIComponent(channelId)}`;
}

/**
 * 为什么与录像页同样拆 pathname + search：
 * 保证在带 `basename` 部署下与 `<Link>` / `navigate` 对象形式一致，避免 query 被错误解析或丢失。
 */
export function buildAlertsTo(channelId: string): { pathname: string; search: string } {
  const params = new URLSearchParams();
  params.set("cid", channelId);
  return { pathname: "/alerts", search: `?${params.toString()}` };
}
