import { GET, GetToken } from "~/service/config/http";
import type { CheckVersionResponse } from "./state";

export const checkVersionKey = "checkVersion";

// 检查版本更新
export async function checkVersion(): Promise<CheckVersionResponse> {
  const res = await GET<CheckVersionResponse>("/app/version/check");
  return res.data;
}

// 获取升级 SSE URL
export function getUpgradeSSEUrl(): string {
  const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";
  return `${baseURL}/app/upgrade`.replace("//", "/");
}

// 获取带认证的升级 SSE URL
export function getUpgradeSSEUrlWithAuth(): string {
  const token = GetToken();
  const baseUrl = getUpgradeSSEUrl();
  return `${baseUrl}?token=Bearer ${token}`;
}
