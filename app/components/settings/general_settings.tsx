import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "antd";
import {
  GetMetadata,
  getMetadataKey,
  SaveMetadata,
} from "~/service/api/metadata/metadata";
import { ErrorHandle } from "~/service/config/error";
import { clearIgnoredNotifications } from "~/service/ws";
import { toastSuccess } from "~/components/xui/toast";

export const COVER_BLUR_KEY = "cover_blur";
export const COVER_BLUR_STORAGE_KEY = "gowvp_cover_blur";

export const DEMO_MODE_KEY = "demo_mode";
export const DEMO_MODE_STORAGE_KEY = "gowvp_demo_mode";

export const LOGIN_PAGE_KEY = "login_page";
export const LOGIN_PAGE_STORAGE_KEY = "gowvp_login_page";

export const DEFAULT_LOGIN_TITLE = "欢迎回来";
export const DEFAULT_LOGIN_SUBTITLE = "开箱即用的监控平台";

export interface LoginPageConfig {
  title: string;
  subtitle: string;
}

/** 从 localStorage 读取登录页配置 */
export function getLoginPageConfig(): LoginPageConfig {
  try {
    const raw = localStorage.getItem(LOGIN_PAGE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { title: DEFAULT_LOGIN_TITLE, subtitle: DEFAULT_LOGIN_SUBTITLE };
}

/**
 * 为什么需要同步标签页标题：
 * 满足浏览器标签页 <title> 优先显示副标题的需求，
 * 当入参未指定时默认从 localStorage 读取，若无配置则回退到默认副标题。
 */
export function syncDocumentTitle(customSubtitle?: string): void {
  if (typeof document === "undefined") {
    return;
  }
  if (customSubtitle !== undefined && customSubtitle.trim() !== "") {
    document.title = customSubtitle.trim();
    return;
  }
  const config = getLoginPageConfig();
  document.title = config.subtitle?.trim() || DEFAULT_LOGIN_SUBTITLE;
}

/** 读取演示模式状态，供全局使用 */
export function isDemoMode(): boolean {
  return localStorage.getItem(DEMO_MODE_STORAGE_KEY) === "true";
}

/**
 * 基础配置面板
 * 为什么同时写 metadata + localStorage：metadata 是跨设备持久化源，
 * localStorage 是同设备快速读取缓存，登录时从 metadata 同步到 localStorage。
 */
export default function GeneralSettings() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: [getMetadataKey, COVER_BLUR_KEY],
    queryFn: () => GetMetadata(COVER_BLUR_KEY),
    retry: false,
  });

  const blurEnabled = data?.data?.ext === "true";

  const { mutate, isPending } = useMutation({
    mutationFn: (enabled: boolean) =>
      SaveMetadata(COVER_BLUR_KEY, String(enabled)),
    onSuccess: (_, enabled) => {
      localStorage.setItem(COVER_BLUR_STORAGE_KEY, String(enabled));
      queryClient.invalidateQueries({
        queryKey: [getMetadataKey, COVER_BLUR_KEY],
      });
    },
    onError: ErrorHandle,
  });

  return (
    <div>
      <h3 className="text-base font-medium mb-4">基础配置</h3>
      <div className="flex items-center justify-between py-3">
        <div>
          <div className="text-sm font-medium text-gray-900">封面毛玻璃</div>
          <div className="text-xs text-gray-500 mt-0.5">
            开启后所有通道封面加微弱模糊效果
          </div>
        </div>
        <Switch
          checked={blurEnabled}
          loading={isPending}
          onChange={(checked) => mutate(checked)}
        />
      </div>
      <div className="flex items-center justify-between py-3">
        <div>
          <div className="text-sm font-medium text-gray-900">清除通知缓存</div>
          <div className="text-xs text-gray-500 mt-0.5">
            清除已忽略的 WebSocket 通知，恢复所有告警推送
          </div>
        </div>
        <button
          type="button"
          className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
          onClick={() => {
            clearIgnoredNotifications();
            toastSuccess("通知缓存已清除");
          }}
        >
          清除
        </button>
      </div>
    </div>
  );
}
