import { GET } from "~/service/config/http";
import type {
  FindRecordingsParams,
  FindRecordingsResponse,
  MonthlyParams,
  MonthlyResponse,
  TimelineParams,
  TimelineResponse,
} from "./state";

export const findRecordingsKey = "findRecordings";
export const timelineKey = "recordingsTimeline";
export const monthlyKey = "recordingsMonthly";

/**
 * 分页查询录像列表
 * axios baseURL 已配置为 /api，Vite 代理会转发到后端
 */
export async function FindRecordings(params: FindRecordingsParams) {
  return await GET<FindRecordingsResponse>("/recordings", params);
}

/**
 * 获取时间轴数据
 */
export async function GetTimeline(params: TimelineParams) {
  return await GET<TimelineResponse>("/recordings/timeline", params);
}

/**
 * 获取月度统计（哪些天有录像）
 */
export async function GetMonthly(params: MonthlyParams) {
  return await GET<MonthlyResponse>("/recordings/monthly", params);
}

/**
 * 获取 HLS m3u8 播放列表 URL
 * ZLM 启用 fMP4 格式录制后，HLS.js 可直接播放
 * @param cid 通道 ID
 * @param startMs 开始时间戳（毫秒）
 * @param endMs 结束时间戳（毫秒）
 * @param token 鉴权 token
 */
export function GetHlsPlaylistUrl(
  cid: string,
  startMs: number,
  endMs: number,
  token?: string
): string {
  const baseUrl = `/recordings/channels/${cid}/index.m3u8?start_ms=${startMs}&end_ms=${endMs}`;
  return token ? `${baseUrl}&token=${token}` : baseUrl;
}

/**
 * 获取单个录像 MP4 文件 URL（备用，用于直接下载或单文件播放）
 * @param path 录像文件路径
 * @param token 鉴权 token
 */
export function GetRecordingMp4Url(path: string, token?: string): string {
  const relativePath = path.startsWith("/") ? path.slice(1) : path;
  const baseUrl = `/static/recordings/${relativePath}`;
  return token ? `${baseUrl}?token=${token}` : baseUrl;
}

/**
 * 获取录像下载 URL
 */
export function GetRecordingDownloadUrl(recordingId: number): string {
  return `/recordings/${recordingId}/download`;
}
