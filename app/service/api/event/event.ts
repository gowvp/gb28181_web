import { GET } from "~/service/config/http";
import type { FindEventsParams, FindEventsResponse } from "./state";

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
