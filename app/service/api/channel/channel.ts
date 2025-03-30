import { GET, POST } from "~/service/http";
import type {
  FindChannelsResponse,
  PlayResponse,
  RefreshSnapshotResponse,
} from "./state";

export async function Play(id: string) {
  return await POST<PlayResponse>(`/channels/${id}/play`);
}

export async function RefreshSnapshot(
  id: string,
  url: string, // rtsp 播放地址
  within_seconds: number // 多少秒以内生成的快照，建议 300 秒
) {
  return await POST<RefreshSnapshotResponse>(`/channels/${id}/snapshot`, {
    url,
    within_seconds,
  });
}

export const findChannelsKey = "findChannels";
export async function FindChannels(data: object) {
  return await GET<FindChannelsResponse>(`/channels`, data);
}
