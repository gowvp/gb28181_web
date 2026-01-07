import { GET } from "~/service/config/http";
import type { FindEventsParams, FindEventsResponse } from "./state";

export const findEventsKey = "findEvents";

/**
 * 分页查询事件列表
 */
export async function FindEvents(params: FindEventsParams) {
  return await GET<FindEventsResponse>("/events", params);
}

/**
 * 获取事件图片 URL
 */
export function GetEventImageUrl(imagePath: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  return `${baseUrl}/events/image/${imagePath}`;
}
