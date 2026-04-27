import { Tour } from "antd";
import type { TourStepProps } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { GetMetadata, SaveMetadata } from "~/service/api/metadata/metadata";
import logger from "~/lib/logger";

const TOUR_METADATA_KEY = "app_tour_completed";
const TOUR_STORAGE_KEY = "app_tour_completed";

interface AppTourProps {
  /** 引导开始前触发，用于准备 UI（如展开 FAB 菜单） */
  onBeforeStep?: (step: number) => void;
  /** 引导结束 */
  onFinish?: () => void;
}

/** 查询 DOM 元素作为 Tour target */
function queryTarget(selector: string): HTMLElement | null {
  return document.querySelector(selector);
}

/**
 * 为什么用 metadata + localStorage 双重存储：
 * localStorage 保证本地首次判断不闪烁，metadata 保证换设备/清缓存后仍能跳过引导。
 */
export default function AppTour({ onBeforeStep, onFinish }: AppTourProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const localFlag = localStorage.getItem(TOUR_STORAGE_KEY);
    if (localFlag === "true") {
      logger.info("AppTour: 本地已标记引导完成，跳过");
      return;
    }

    // 延迟检查，等 ReactFlow 渲染完
    const timer = setTimeout(() => {
      setOpen(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  /** 标记引导已完成，同步到 localStorage 和 metadata */
  const markCompleted = useCallback(async () => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    try {
      await SaveMetadata(TOUR_METADATA_KEY, "true");
      logger.info("AppTour: 引导完成标记已同步到服务端");
    } catch (e) {
      logger.warn("AppTour: 同步引导标记到服务端失败", e);
    }
  }, []);

  /** 临时关闭（遮罩点击/ESC），不持久化，下次刷新仍显示 */
  const handleDismiss = useCallback(() => {
    setOpen(false);
    onFinish?.();
  }, [onFinish]);

  /** 永久结束引导（"跳过" 或 "开始自行探索" 按钮），写入 metadata */
  const handleComplete = useCallback(() => {
    setOpen(false);
    markCompleted();
    onFinish?.();
  }, [markCompleted, onFinish]);

  const handleStepChange = useCallback((step: number) => {
    setCurrent(step);
    onBeforeStep?.(step);
  }, [onBeforeStep]);

  const steps: TourStepProps[] = useMemo(() => [
    {
      title: t("tour_dataflow_title"),
      description: t("tour_dataflow_desc"),
      target: () => queryTarget('[data-tour-id="dataflow"]')!,
      placement: "rightBottom",
    },
    {
      title: t("tour_floor_plan_title"),
      description: t("tour_floor_plan_desc"),
      target: () => queryTarget('[data-tour-id="floor-plan"]')!,
      placement: "rightBottom",
    },
    {
      title: "GB/T28181",
      description: t("tour_gb28181_desc"),
      target: () => queryTarget('[data-tour-id="gb28181"]')!,
      placement: "right",
    },
    {
      title: t("tour_zlm_settings_title"),
      description: t("tour_zlm_settings_desc"),
      target: () => queryTarget('[data-tour-id="zlm-settings"]')!,
      placement: "left",
    },
    {
      title: t("tour_fab_menu_title"),
      description: t("tour_fab_menu_desc"),
      target: () => queryTarget('[data-tour-id="fab-menu"]')!,
      placement: "leftBottom",
    },
    {
      title: t("tour_language_title"),
      description: t("tour_language_desc"),
      target: () => queryTarget('[data-tour-id="fab-language"]')!,
      placement: "left",
    },
  ], [t]);

  if (!open) return null;

  return (
    <Tour
      open={open}
      current={current}
      onChange={handleStepChange}
      onClose={handleDismiss}
      steps={steps}
      indicatorsRender={(cur, total) => (
        <span className="text-xs text-gray-400">
          {cur + 1} / {total}
        </span>
      )}
      actionsRender={(_, info) => {
        const isLast = info.current === info.total - 1;
        return (
          <div className="flex gap-2">
            {!isLast && (
              <button
                type="button"
                onClick={handleComplete}
                className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                {t("tour_skip")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isLast) {
                  handleComplete();
                } else {
                  handleStepChange(info.current + 1);
                }
              }}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isLast ? t("tour_start_exploring") : t("tour_next")}
            </button>
          </div>
        );
      }}
    />
  );
}
