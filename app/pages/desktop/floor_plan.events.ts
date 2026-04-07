import {
  FindEvents,
  FindLatestChannelEvent,
  MapEventToLatestChannelEvent,
  type LatestChannelEvent,
} from "~/service/api/event/event";

const latestEventCache = new Map<string, Promise<LatestChannelEvent | null>>();

const PREFETCH_PAGE_SIZE = 500;
const PREFETCH_MAX_PAGES = 8;

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
 * 为什么在 owl 无批量 latest 接口时仍做预取：
 * 多通道若只 hover 才请求，首次扫视会大量串行；用全局时间排序分页拉取，在客户端按 cid 保留最新一条，能把多次单通道请求合并为少量列表请求，并与单通道查询共用缓存与字段映射。
 */
export async function prefetchLatestEventsForChannelIds(
  channelIds: string[],
): Promise<Map<string, LatestChannelEvent>> {
  const want = new Set(channelIds.filter(Boolean));
  if (want.size === 0) {
    return new Map();
  }

  const bestByCid = new Map<string, LatestChannelEvent>();

  try {
    for (let page = 1; page <= PREFETCH_MAX_PAGES; page += 1) {
      const response = await FindEvents({
        page,
        size: PREFETCH_PAGE_SIZE,
        sort: "started_at desc",
      });

      const items = response.data?.items ?? [];
      const total = response.data?.total ?? 0;

      for (const item of items) {
        const cid = item.cid;
        if (!cid || !want.has(cid) || bestByCid.has(cid)) {
          continue;
        }
        bestByCid.set(cid, MapEventToLatestChannelEvent(item, cid));
      }

      let allFound = true;
      for (const id of want) {
        if (!bestByCid.has(id)) {
          allFound = false;
          break;
        }
      }
      if (allFound) {
        break;
      }
      if (items.length === 0 || items.length < PREFETCH_PAGE_SIZE || (total > 0 && page * PREFETCH_PAGE_SIZE >= total)) {
        break;
      }
    }
  } catch (error) {
    console.warn("[floor-plan] prefetch latest events failed", error);
    return new Map();
  }

  for (const [cid, latest] of bestByCid) {
    latestEventCache.set(cid, Promise.resolve(latest));
  }

  return bestByCid;
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
