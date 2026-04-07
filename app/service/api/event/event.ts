import { GET } from "~/service/config/http";
import type { Event, FindEventsParams, FindEventsResponse } from "./state";

export const findEventsKey = "findEvents";

export async function FindEvents(params: FindEventsParams) {
  return await GET<FindEventsResponse>("/events", params);
}

export function GetEventImageUrl(imagePath: string): string {
  if (!imagePath) return imagePath;
  if (imagePath.startsWith("http")) {
    return imagePath;
  }
  return `${window.location.origin}/events/image/${imagePath}`;
}

export type LatestChannelEvent = {
  channelId: string;
  startedAt: number;
  imageSrc: string;
  label: string;
  score: number;
  raw: Event;
};

/**
 * 为什么单独导出映射函数：
 * 批量预取与单通道查询共用同一字段语义，避免「列表页一条」与「详情一条」展示字段漂移。
 */
export function MapEventToLatestChannelEvent(item: Event, cid: string): LatestChannelEvent {
  return {
    channelId: cid,
    startedAt: item.started_at,
    imageSrc: GetEventImageUrl(item.image_path),
    label: item.label,
    score: item.score,
    raw: item,
  };
}

export async function FindLatestChannelEvent(cid: string): Promise<LatestChannelEvent | null> {
  const response = await FindEvents({
    page: 1,
    size: 1,
    cid,
    sort: "started_at desc",
  });

  const item = response.data.items?.[0];
  if (!item) {
    return null;
  }

  return MapEventToLatestChannelEvent(item, cid);
}
