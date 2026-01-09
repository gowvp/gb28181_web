import { GET, POST } from "~/service/config/http";
import type {
  AddZoneInput,
  AddZoneResponse,
  DisableAIResponse,
  EnableAIResponse,
  FindChannelsResponse,
  GetZonesResponse,
  PlayResponse,
  RefreshSnapshotResponse,
} from "./state";

export async function Play(id: string) {
  return await POST<PlayResponse>(`/channels/${id}/play`);
}

export async function RefreshSnapshot(
  id: string,
  url: string, // rtsp 播放地址
  within_seconds: number, // 多少秒以内生成的快照，建议 300 秒
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

// 区域管理 API
export const getZonesKey = "getZones";
export async function GetZones(channelId: string) {
  return await GET<GetZonesResponse>(`/channels/${channelId}/zones`);
}

export async function AddZone(channelId: string, zone: AddZoneInput) {
  return await POST<AddZoneResponse>(`/channels/${channelId}/zones`, zone);
}

// AI 检测管理 API
export async function EnableAI(channelId: string) {
  return await POST<EnableAIResponse>(`/channels/${channelId}/ai/enable`);
}

export async function DisableAI(channelId: string) {
  return await POST<DisableAIResponse>(`/channels/${channelId}/ai/disable`);
}
