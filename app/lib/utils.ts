import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 重写流媒体地址的 host，修复 ZLM 返回 127.0.0.1/localhost 导致浏览器无法连接的问题。
 *
 * 为什么: ZLM 默认配置的流地址 IP 是 127.0.0.1，浏览器端需要改为当前页面的 hostname。
 * 非环回地址（如内网 IP/域名）保留原值，不做替换。
 */
export function rewriteStreamUrl(url: string): string {
  if (!url || typeof window === "undefined") return url;
  try {
    const u = new URL(url);
    if (u.hostname === "127.0.0.1" || u.hostname === "localhost") {
      u.hostname = window.location.hostname;
    }
    return u.toString();
  } catch {
    return url;
  }
}
