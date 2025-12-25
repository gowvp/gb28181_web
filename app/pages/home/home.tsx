import { Outlet } from "@tanstack/react-router";
import { Cctv, Home, MonitorUp, Waypoints } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TopNavigation } from "./top_navigation";

// 菜单数据（从app_sidebar.tsx复制）
function useNavigationData() {
  const { t } = useTranslation("common");

  return {
    user: {
      name: t("app_name"),
      email: t("app_title"),
      avatar: "./assets/imgs/bg.webp",
    },
    projects: [
      {
        name: t("quick_desktop"),
        url: "/desktop",
        icon: Home,
      },
      {
        name: t("gb_channel"),
        url: "/nchannels",
        icon: Cctv,
      },
      {
        name: t("rtmp_stream"),
        url: "/rtmps",
        icon: MonitorUp,
      },
      {
        name: t("rtsp_proxy"),
        url: "/rtsps",
        icon: Waypoints,
      },
    ],
  };
}

export default function Page() {
  const navigationData = useNavigationData();

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
          {/* 子页面容器 - 80%宽度居中，小屏幕全宽 */}
          {/* <div className="w-full max-w-none sm:w-4/5 sm:mx-auto px-4 sm:px-6 lg:px-4"> */}
          <div className="w-full max-w-none px-1 lg:px-16">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
