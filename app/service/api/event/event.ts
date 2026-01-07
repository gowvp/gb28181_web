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
 * 直接使用当前页面的 origin 拼接图片路径
 */
export function GetEventImageUrl(imagePath: string): string {
  return `${window.location.origin}/events/image/${imagePath}`;
}
