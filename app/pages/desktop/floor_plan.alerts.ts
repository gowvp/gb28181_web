/**
 * 为什么告警页用 query 而不是路径参数：
 * 告警列表已有通道下拉筛选，与 `cid` 查询参数对齐只需初始化 `selectedChannel`，无需新增路由形态或后端改动。
 */
export function buildAlertsHref(channelId: string): string {
  return `/alerts?cid=${encodeURIComponent(channelId)}`;
}
