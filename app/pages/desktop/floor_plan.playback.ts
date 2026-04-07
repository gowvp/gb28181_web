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
