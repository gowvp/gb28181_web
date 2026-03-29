import { FindLatestChannelEvent, type LatestChannelEvent } from "~/service/api/event/event";

const latestEventCache = new Map<string, Promise<LatestChannelEvent | null>>();

export async function getLatestCameraEvent(channelId: string | null | undefined) {
  if (!channelId) {
    return null;
  }

  if (!latestEventCache.has(channelId)) {
    latestEventCache.set(channelId, FindLatestChannelEvent(channelId));
  }

  return await latestEventCache.get(channelId)!;
}

export function clearLatestCameraEventCache(channelId?: string) {
  if (!channelId) {
    latestEventCache.clear();
    return;
  }
  latestEventCache.delete(channelId);
}
