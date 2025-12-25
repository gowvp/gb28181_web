import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { App as AntdApp, ConfigProvider } from "antd";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
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
// 页面组件懒加载
import LoginView from "~/pages/login/login";
import RtmpView from "~/pages/rtmp/rtmp";
import RtspView from "~/pages/rtsp/rtsp";
import WallView from "~/pages/wall/wall";
import ZonesView from "~/pages/zones/zones";

// 创建 QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      gcTime: 5 * 60 * 1000,
    },
  },
});

// 根路由
const rootRoute = createRootRoute({
  component: () => (
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
      <TanStackRouterDevtools />
    </I18nextProvider>
  ),
});

// 登录页面路由
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LoginView,
});

// 带顶部导航的布局路由
const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "layout",
  component: HomeLayout,
});

// 子页面路由
const desktopRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/desktop",
  component: DesktopView,
});

const homeRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/home",
  component: DashboardView,
});

const devicesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/devices",
  component: DeviceView,
});

const rtmpsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/rtmps",
  component: RtmpView,
});

const rtspsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/rtsps",
  component: RtspView,
});

// 搜索参数类型定义
type ChannelsSearch = {
  device_id?: string;
};

type ZonesSearch = {
  cid?: string;
};

const channelsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/channels",
  component: ChannelView,
  validateSearch: (search: Record<string, unknown>): ChannelsSearch => ({
    device_id:
      typeof search.device_id === "string" ? search.device_id : undefined,
  }),
});

const nchannelsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/nchannels",
  component: ChannelsView,
});

const gbSipRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/gb/sip",
  component: ConfigView,
});

const wallRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/wall",
  component: WallView,
});

const zonesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/zones",
  component: ZonesView,
  validateSearch: (search: Record<string, unknown>): ZonesSearch => ({
    cid: typeof search.cid === "string" ? search.cid : undefined,
  }),
});

// 构建路由树
const routeTree = rootRoute.addChildren([
  loginRoute,
  layoutRoute.addChildren([
    desktopRoute,
    homeRoute,
    devicesRoute,
    rtmpsRoute,
    rtspsRoute,
    channelsRoute,
    nchannelsRoute,
    gbSipRoute,
    wallRoute,
    zonesRoute,
  ]),
]);

// 动态获取基础路径（支持部署到 /web, /www 等任意子目录）
function getBasepath(): string {
  const pathname = window.location.pathname;
  // 从 pathname 中提取基础路径，例如 /web/desktop -> /web
  const match = pathname.match(/^(\/[^/]+)/);
  // 如果路径是根路径或者没有匹配到，返回空字符串
  if (!match || pathname === "/") return "";
  // 检查是否是已知的页面路由，如果是则说明部署在根路径
  const knownRoutes = [
    "/desktop",
    "/home",
    "/devices",
    "/rtmps",
    "/rtsps",
    "/channels",
    "/nchannels",
    "/gb",
    "/wall",
    "/zones",
  ];
  if (knownRoutes.some((route) => pathname.startsWith(route))) return "";
  return match[1];
}

// 创建路由器
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
  basepath: getBasepath(),
});

// 注册路由类型
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// 渲染应用
const rootElement = document.getElementById("app");
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}
