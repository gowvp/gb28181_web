import { FindLatestChannelEvent, type LatestChannelEvent } from "~/service/api/event/event";

const latestEventCache = new Map<string, Promise<LatestChannelEvent | null>>();

/**
 * 为什么用 Promise 缓存而不是只缓存结果：
 * 同一通道在短时间可能被多次 hover，并发请求会产生重复负载且竞态难排；用单飞 Promise 合并同一 channel 的未完成请求，既省流量又避免后返回的旧结果覆盖新结果。
 */
export async function getLatestCameraEvent(channelId: string | null | undefined) {
  if (!channelId) {
    return null;
  }

  if (!latestEventCache.has(channelId)) {
    const promise = FindLatestChannelEvent(channelId).catch((error) => {
      console.warn("[floor-plan] failed to load latest AI event for channel", { channelId, error });
      latestEventCache.delete(channelId);
      return null;
    });
    latestEventCache.set(channelId, promise);
  }

  return await latestEventCache.get(channelId)!;
}

/**
 * 为什么在解绑或需要强制刷新时要清缓存：
 * 通道与布局变更后，旧缓存会让 hover 仍显示过期事件；提供按 channel 清理入口，避免只能清全局或刷新整页才能对齐数据。
 */
export function clearLatestCameraEventCache(channelId?: string) {
  if (!channelId) {
    latestEventCache.clear();
    return;
  }
  latestEventCache.delete(channelId);
}
