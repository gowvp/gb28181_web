import { GET } from "~/service/config/http";
import type {
  FindRecordingsParams,
  FindRecordingsResponse,
  MonthlyParams,
  MonthlyResponse,
  TimelineParams,
  TimelineResponse,
} from "./state";
import { getToken } from "../user/user";

export const findRecordingsKey = "findRecordings";
export const timelineKey = "recordingsTimeline";
export const monthlyKey = "recordingsMonthly";

export async function FindRecordings(params: FindRecordingsParams) {
  return await GET<FindRecordingsResponse>("/recordings", params);
}

export async function GetTimeline(params: TimelineParams) {
  return await GET<TimelineResponse>("/recordings/timeline", params);
}

export async function GetMonthly(params: MonthlyParams) {
  return await GET<MonthlyResponse>("/recordings/monthly", params);
}

function normalizeAuthToken(token?: string | null): string | undefined {
  const value = (token ?? getToken() ?? "").trim();
  if (!value) return undefined;
  return value.startsWith("Bearer ") ? value : `Bearer ${value}`;
}

function ensureAbsoluteUrl(input: string): URL {
  if (/^https?:\/\//i.test(input)) {
    return new URL(input);
  }
  return new URL(input, window.location.origin);
}

function ensureRecordingPath(path: string): string {
  const raw = path.trim();
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/static/recordings/")) return raw;
  if (raw.startsWith("static/recordings/")) return `/${raw}`;
  const relativePath = raw.startsWith("/") ? raw.slice(1) : raw;
  return `/static/recordings/${relativePath}`;
}

export function GetHlsPlaylistUrl(
  cid: string,
  startMs: number,
  endMs: number,
  token?: string,
): string {
  const baseUrl = `/recordings/channels/${cid}/index.m3u8?start_ms=${startMs}&end_ms=${endMs}`;
  const authToken = normalizeAuthToken(token);
  return authToken
    ? `${baseUrl}&token=${encodeURIComponent(authToken)}`
    : baseUrl;
}

export function GetRecordingMp4Url(path: string, token?: string): string {
  const normalizedPath = ensureRecordingPath(path);
  if (!normalizedPath) return normalizedPath;

  const url = ensureAbsoluteUrl(normalizedPath);
  const authToken = normalizeAuthToken(token);
  if (authToken) {
    url.searchParams.set("token", authToken);
  }
  return url.toString();
}

export function GetRecordingDownloadUrl(recordingId: number): string {
  return `/recordings/${recordingId}/download`;
}
