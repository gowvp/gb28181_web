import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntdApp, ConfigProvider } from "antd";
import { StrictMode, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
} from "react-router";
import { Toaster } from "~/components/ui/sonner";
import { DrawerCSSProvider } from "~/components/xui/drawer";
import {
  LOGIN_PAGE_KEY,
  LOGIN_PAGE_STORAGE_KEY,
  type LoginPageConfig,
  syncDocumentTitle,
} from "~/components/settings/general_settings";
import { GetMetadata } from "~/service/api/metadata/metadata";
import { startWs } from "~/service/ws";
import i18n from "~/i18n/config";
import "./app.css";

import ChannelView from "~/pages/channel/channel";
import ChannelsView from "~/pages/channels/channels";
import DashboardView from "~/pages/dashboard/dashboard";
import DesktopView from "~/pages/desktop/desktop";
import ConfigView from "~/pages/device/config/config";
import DeviceView from "~/pages/device/device";
import HomeLayout from "~/pages/home/home";
import LoginView from "~/pages/login/login";
import RtmpView from "~/pages/rtmp/rtmp";
import RtspView from "~/pages/rtsp/rtsp";
import AlertsView from "~/pages/alerts/alerts";
import WallView from "~/pages/wall/wall";
import ZonesView from "~/pages/zones/zones";
import RecordingsView from "~/pages/recordings/recordings";
import RecordingDetailView from "~/pages/recordings/detail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      gcTime: 5 * 60 * 1000,
    },
  },
});

/**
 * 为什么在根布局同步网页标题：
 * 保证在系统任一页面打开或刷新时，都能及时从 localStorage 初始化标签页副标题，
 * 并在后台静默拉取服务端最新配置完成同步。
 */
function useDocumentTitleSync() {
  useEffect(() => {
    syncDocumentTitle();
    GetMetadata(LOGIN_PAGE_KEY)
      .then((res) => {
        if (!res.data?.ext) return;
        try {
          const remote: LoginPageConfig = JSON.parse(res.data.ext);
          if (remote.subtitle) {
            syncDocumentTitle(remote.subtitle);
            localStorage.setItem(LOGIN_PAGE_STORAGE_KEY, res.data.ext);
          }
        } catch { /* ignore */ }
      })
      .catch(() => { /* 静默失败，保持 localStorage 缓存 */ });
  }, []);
}

// 根布局：提供全局 Provider 上下文
function RootLayout() {
  useDocumentTitleSync();
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: "#000",
            },
          }}
        >
          <AntdApp>
            <DrawerCSSProvider>
              <Outlet />
            </DrawerCSSProvider>
          </AntdApp>
        </ConfigProvider>
      </QueryClientProvider>
      <Toaster />
    </I18nextProvider>
  );
}

// 动态获取基础路径（支持部署到 /web, /www 等任意子目录）
function getBasename(): string {
  const base = import.meta.env.BASE_URL;
  if (base && base !== "/") {
    return base.endsWith("/") ? base.slice(0, -1) : base;
  }
  return "";
}

const router = createBrowserRouter(
  [
    {
      element: <RootLayout />,
      children: [
        { path: "/", element: <LoginView /> },
        { path: "desktop", element: <DesktopView /> },
        {
          element: <HomeLayout />,
          children: [
            { path: "home", element: <DashboardView /> },
            { path: "devices", element: <DeviceView /> },
            { path: "rtmps", element: <RtmpView /> },
            { path: "rtsps", element: <RtspView /> },
            { path: "alerts", element: <AlertsView /> },
            { path: "channels", element: <ChannelView /> },
            { path: "nchannels", element: <ChannelsView /> },
            { path: "gb/sip", element: <ConfigView /> },
            { path: "wall", element: <WallView /> },
            { path: "zones", element: <ZonesView /> },
            { path: "playback", element: <RecordingsView /> },
            { path: "playback/detail", element: <RecordingDetailView /> },
          ],
        },
      ],
    },
  ],
  { basename: getBasename() },
);

/**
 * 为什么把 root 挂在 globalThis：
 * Vite HMR 会重新执行本模块，模块级变量会丢失；若再次 createRoot 同一 DOM 会告警。全局单例在热更新后仍指向已创建的 root，只重复 render。
 */
const REACT_ROOT_KEY = "__gowvp_react_root__" as const;
type AppRoot = ReturnType<typeof ReactDOM.createRoot>;
const globalStore = globalThis as typeof globalThis & { [REACT_ROOT_KEY]?: AppRoot };

// 页面加载时若已有 token（刷新场景），自动重连 WebSocket
startWs();

const rootElement = document.getElementById("app");
if (rootElement) {
  if (!globalStore[REACT_ROOT_KEY]) {
    globalStore[REACT_ROOT_KEY] = ReactDOM.createRoot(rootElement);
  }
  globalStore[REACT_ROOT_KEY]!.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
