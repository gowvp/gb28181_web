import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  // 索引路由在其父级 URL 处呈现到其父级Outlet （类似于默认子路由）。
  index("login/login.tsx"),

  layout("routes/home.tsx", [
    route("home", "dashboard/dashboard.tsx"),
    route("devices", "device/device.tsx"),
  ]),
] satisfies RouteConfig;
