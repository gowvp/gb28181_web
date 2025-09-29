import React from "react";
import { Outlet } from "react-router";
import { TopNavigation } from "./top_navigation";
import { Cctv, MonitorUp, Waypoints, Home } from "lucide-react";
import type { Route } from "./+types/home";

// 菜单数据（从app_sidebar.tsx复制）
const navigationData = {
  user: {
    name: "gowvp",
    email: "GB/T28181",
    avatar: "/assets/imgs/bg.webp",
  },
  projects: [
    {
      name: "快捷桌面",
      url: "desktop",
      icon: Home,
    },
    {
      name: "国标通道",
      url: "nchannels",
      icon: Cctv,
    },
    {
      name: "推流列表",
      url: "rtmps",
      icon: MonitorUp,
    },
    {
      name: "拉流代理",
      url: "rtsps",
      icon: Waypoints,
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-empty-pattern
function meta({}: Route.MetaArgs) {
  return [
    { title: "GoWVP 开箱即用的国标平台" },
    { name: "description", content: "GOWVP" },
  ];
}
export default function Page() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* 顶部导航菜单 */}
      <TopNavigation
        items={navigationData.projects}
        user={navigationData.user}
      />

      {/* 主内容区域 */}
      <div className="flex-1 overflow-auto">
        <div
          className="min-w-0 h-full"
          style={{
            background:
              "linear-gradient(to bottom right, white 30%, #FCFEFF 70%)",
          }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}
