import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // 索引路由在其父级 URL 处呈现到其父级Outlet （类似于默认子路由）。
  index("routes/login.tsx"),
  route("home", "routes/home.tsx"),
  route("devices", "routes/device/index.tsx"),
] satisfies RouteConfig;
