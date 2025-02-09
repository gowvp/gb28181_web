import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  // 索引路由在其父级 URL 处呈现到其父级Outlet （类似于默认子路由）。
  index("routes/login/login.tsx"),

  // 旧布局
  // layout("routes/home.tsx", [
  //   route("home", "routes/dashboard/dashboard.tsx"),
  //   route("devices", "routes/device/device.tsx"),
  //   route("rtmps", "routes/rtmp/rtmp.tsx"),
  //   route("channels", "routes/channel/channel.tsx"),
  // ]),

  // 新布局
  layout("routes/home/home.tsx", [
    route("home", "routes/dashboard/dashboard.tsx"),
    route("devices", "routes/device/device.tsx"),
    route("rtmps", "routes/rtmp/rtmp.tsx"),
    route("channels", "routes/channel/channel.tsx"),
  ]),
] satisfies RouteConfig;
