import { DELETE, GET, POST, PUT } from "~/service/config/http";
import type {
  AddChannelInput,
  AddChannelResponse,
  AddZoneInput,
  AddZoneResponse,
  DisableAIResponse,
  EditChannelInput,
  EditChannelResponse,
  EnableAIResponse,
  FindChannelsResponse,
  GetZonesResponse,
  PlayResponse,
  RefreshSnapshotResponse,
} from "./state";

export async function Play(id: string) {
  return await POST<PlayResponse>(`/channels/${id}/play`);
}

// StopPlay 停止播放（幂等，始终返回成功）
export async function StopPlay(id: string) {
  return await POST<{ msg: string }>(`/channels/${id}/stop`);
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

// AddChannel 添加 RTMP/RTSP 通道
export async function AddChannel(data: AddChannelInput) {
  return await POST<AddChannelResponse>(`/channels`, data);
}

// EditChannel 编辑通道
export async function EditChannel(id: string, data: EditChannelInput) {
  if (id === "") id = "unknown";
  return await PUT<EditChannelResponse>(`/channels/${id}`, data);
}

// DelChannel 删除 RTMP/RTSP 通道
export async function DelChannel(id: string) {
  if (id === "") id = "unknown";
  return await DELETE<void>(`/channels/${id}`);
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

// 录像模式管理 API
export type RecordMode = "always" | "ai" | "none";

export type SetRecordModeResponse = {
  id: string;
  record_mode: RecordMode;
  message: string;
};

export async function SetRecordMode(channelId: string, mode: RecordMode) {
  return await POST<SetRecordModeResponse>(`/channels/${channelId}/record_mode`, { mode });
}

// PTZ 云台控制 API
export type PTZAction = "continuous" | "stop" | "absolute" | "relative" | "preset";
export type PTZDirection = 
  | "up" | "down" | "left" | "right"
  | "upleft" | "upright" | "downleft" | "downright"
  | "zoomin" | "zoomout";
export type PresetOp = "goto" | "set" | "remove";

export interface PTZControlInput {
  action: PTZAction;
  direction?: PTZDirection;
  speed?: number;        // 0-1, 默认 0.5
  x?: number;            // -1 到 1 (绝对/相对移动)
  y?: number;            // -1 到 1 (绝对/相对移动)
  zoom?: number;         // 0 到 1 (绝对/相对移动)
  preset_id?: string;    // 预置位 ID
  preset_op?: PresetOp;  // 预置位操作
}

export type PTZControlResponse = {
  msg: string;
};

export async function PTZControl(channelId: string, data: PTZControlInput) {
  return await POST<PTZControlResponse>(`/channels/${channelId}/ptz/control`, data);
}
