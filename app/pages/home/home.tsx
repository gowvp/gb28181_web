import { Outlet } from "@tanstack/react-router";
import { Bell, Cctv, Home, MonitorUp, Waypoints } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import VersionUpdateModal, {
  isVersionIgnored,
} from "~/components/version/version_update_modal";
import logger from "~/lib/logger";
import type { CheckVersionResponse } from "~/service/api/version/state";
import { checkVersion } from "~/service/api/version/version";
import { TopNavigation } from "./top_navigation";

const VERSION_CHECKED_KEY = "GOWVP_VERSION_CHECKED_SESSION";

// 菜单数据（从app_sidebar.tsx复制）
function useNavigationData() {
  const { t } = useTranslation("common");

  return {
    user: {
      name: t("app_name"),
      email: t("app_title"),
      avatar: "./assets/imgs/bg.avif",
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
        name: t("alerts"),
        url: "/alerts",
        icon: Bell,
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
  const [versionInfo, setVersionInfo] = useState<CheckVersionResponse | null>(
    null
  );
  // 防止竞态条件：确保组件卸载后不再更新状态
  const isMountedRef = useRef(true);

  // 每次登录仅检查一次版本（使用 sessionStorage）
  useEffect(() => {
    isMountedRef.current = true;

    const hasChecked = sessionStorage.getItem(VERSION_CHECKED_KEY);
    if (hasChecked) {
      return;
    }

    const checkForUpdates = async () => {
      try {
        const result = await checkVersion();

        // 组件已卸载时不更新状态
        if (!isMountedRef.current) {
          logger.info("版本检查完成，但组件已卸载，跳过状态更新");
          return;
        }

        logger.info("版本检查结果:", result);

        // 请求成功后才标记为已检查
        sessionStorage.setItem(VERSION_CHECKED_KEY, "true");

        // 如果有新版本且该版本未被忽略，则显示更新弹窗
        if (result.has_new_version && !isVersionIgnored(result.new_version)) {
          setVersionInfo(result);
        }
      } catch (error) {
        // 版本检查失败不做任何提示，静默处理
        // 注意：失败时不标记 sessionStorage，下次会重试
        logger.error("版本检查失败:", error);
      }
    };

    checkForUpdates();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

      {/* 全局版本更新弹窗 */}
      {versionInfo && (
        <VersionUpdateModal
          versionInfo={versionInfo}
          onClose={() => setVersionInfo(null)}
        />
      )}
    </div>
  );
}
