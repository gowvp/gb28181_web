/**
 * 为什么与录像列表页拼出相同的 query：
 * 详情页只认 `cid` + `date`，与 `recordings.tsx` 保持一致可避免「从平面图进的录像」与「从列表进的录像」行为分叉，排查问题时也只需对照一种 URL 形态。
 */
export function buildPlaybackDetailHref(channelId: string): string {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  return `/playback/detail?cid=${encodeURIComponent(channelId)}&date=${encodeURIComponent(dateStr)}`;
}

/**
 * 为什么单独提供 pathname + search：
 * `navigate("/playback/detail?...")` 在部分环境与 basename 组合时解析不稳定；`navigate({ pathname, search })` 与 `<Link to={{ pathname, search }}>` 由路由统一拼接 basename，避免点到按钮却留在桌面页。
 */
export function buildPlaybackDetailTo(channelId: string): { pathname: string; search: string } {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  const params = new URLSearchParams();
  params.set("cid", channelId);
  params.set("date", dateStr);
  return { pathname: "/playback/detail", search: `?${params.toString()}` };
}
