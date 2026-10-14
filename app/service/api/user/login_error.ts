function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmptyText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// Keep the backend's user-facing msg; HTTP status alone cannot identify bad credentials.
export function getLoginErrorMessage(error: unknown): string {
  if (!isRecord(error)) return "登录失败，请重试";

  const response = isRecord(error.response) ? error.response : undefined;
  const data = isRecord(response?.data) ? response.data : undefined;
  const businessMessage = nonEmptyText(data?.msg);
  if (businessMessage) return businessMessage;

  if (response?.status === 429) return "登录请求过于频繁，请稍后重试";
  if (typeof response?.status === "number") {
    return `登录请求失败（HTTP ${response.status}），请稍后重试`;
  }
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return "登录请求超时，请稍后重试";
  }
  if (error.isAxiosError === true) return "网络异常，请检查连接后重试";

  return nonEmptyText(error.message) || "登录失败，请重试";
}
