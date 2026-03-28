import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntdApp, ConfigProvider } from "antd";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
} from "react-router";
import { Toaster } from "~/components/ui/sonner";
import { DrawerCSSProvider } from "~/components/xui/drawer";
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

// 根布局：提供全局 Provider 上下文
function RootLayout() {
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

const rootElement = document.getElementById("app");
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
