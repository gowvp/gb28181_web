import { Spin } from "antd";
import { Bell, ExternalLink } from "lucide-react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { CameraMarker, LatestCameraEvent } from "~/pages/desktop/floor_plan.types";

const CARD_WIDTH = 288;
const CARD_HEIGHT_ESTIMATE = 320;

/**
 * 为什么单独做时间格式化并包 try：
 * 后端或脏数据可能给出非法时间戳，直接在 UI 层抛错会让整张卡片白屏；降级为可读的字符串更利于现场对照日志排查。
 */
function formatEventTime(timestamp: number | null | undefined) {
  if (!timestamp) {
    return "-";
  }
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return String(timestamp);
  }
}

/**
 * 为什么按视口裁剪：
 * 卡片用 fixed 贴在视口上，必须用 window 尺寸裁剪，避免贴边被裁切。
 */
function clampCardPositionViewport(left: number, top: number) {
  const pad = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  let x = left;
  let y = top;
  if (x + CARD_WIDTH > vw - pad) {
    x = vw - CARD_WIDTH - pad;
  }
  if (y + CARD_HEIGHT_ESTIMATE > vh - pad) {
    y = vh - CARD_HEIGHT_ESTIMATE - pad;
  }
  if (x < pad) {
    x = pad;
  }
  if (y < pad) {
    y = pad;
  }
  return { x, y };
}

/**
 * 为什么用 Portal + fixed + 高于 FAB 的 z-index：
 * 卡片若在画布容器内 absolute，层叠上下文低于右下角 fixed z-50 的 FAB，且关闭菜单的透明层仍会占位拦截；挂到 body 并 z-[100] 才能保证链接可点。
 * 为什么用画布容器的 getBoundingClientRect + 锚点：
 * Konva 内坐标需换算成视口像素，才能与 fixed 对齐。
 */
export function CameraHoverCard({
  camera,
  latestEvent,
  loading,
  anchorX,
  anchorY,
  canvasContainerRef,
  channelOnline = null,
  playbackTo = null,
  alertsTo = null,
  onCardPointerEnter,
  onCardPointerLeave,
}: {
  camera: CameraMarker;
  latestEvent: LatestCameraEvent | null;
  loading: boolean;
  /** 相对画布容器左上角的屏幕对齐坐标（与 Stage 内 worldToScreen 一致） */
  anchorX: number;
  anchorY: number;
  canvasContainerRef: RefObject<HTMLDivElement | null>;
  channelOnline?: boolean | null | undefined;
  playbackTo?: { pathname: string; search: string } | null;
  alertsTo?: { pathname: string; search: string } | null;
  /** 鼠标移入卡片时取消「离开摄像头」的延时清除，否则移向按钮途中卡片会消失 */
  onCardPointerEnter?: () => void;
  onCardPointerLeave?: () => void;
}) {
  const { t } = useTranslation("desktop");

  let left = 0;
  let top = 0;
  const el = canvasContainerRef.current;
  if (el && typeof window !== "undefined") {
    const rect = el.getBoundingClientRect();
    const clamped = clampCardPositionViewport(rect.left + anchorX + 18, rect.top + anchorY + 18);
    left = clamped.x;
    top = clamped.y;
  }

  const canPlayback = Boolean(camera.channelId && playbackTo);
  const canAlerts = Boolean(camera.channelId && alertsTo);

  const node = (
    <div
      className="pointer-events-none fixed z-[100] w-72 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur"
      style={{ left, top }}
      onMouseEnter={onCardPointerEnter}
      onMouseLeave={onCardPointerLeave}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 text-sm font-semibold text-gray-900">
          {camera.channelName || t("camera_unbound")}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {canAlerts && alertsTo ? (
            <Link
              to={alertsTo}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700"
            >
              <Bell className="h-3.5 w-3.5" />
              {t("open_alerts")}
            </Link>
          ) : null}
          {canPlayback && playbackTo ? (
            <Link
              to={playbackTo}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto inline-flex items-center gap-1 rounded-lg bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-800"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("open_playback")}
            </Link>
          ) : null}
        </div>
      </div>
      {camera.channelId != null ? (
        <div className="mb-2 text-xs text-gray-600">
          <span className="font-medium text-gray-900">{t("channel_status")}: </span>
          {channelOnline === undefined
            ? t("channel_online_unknown")
            : channelOnline
              ? t("channel_online")
              : t("channel_offline")}
        </div>
      ) : null}
      {loading ? (
        <div className="flex min-h-24 items-center justify-center">
          <Spin size="small" />
        </div>
      ) : latestEvent ? (
        <>
          {latestEvent.imageSrc ? (
            <img
              src={latestEvent.imageSrc}
              alt={latestEvent.label}
              className="mb-3 h-36 w-full rounded-lg border border-gray-200 object-cover"
              onError={() => {
                console.warn("[floor-plan] failed to load hover event image", {
                  channelId: latestEvent.channelId,
                  imageSrc: latestEvent.imageSrc,
                });
              }}
            />
          ) : null}
          <div className="space-y-1 text-xs text-gray-600">
            <div>
              <span className="font-medium text-gray-900">{t("latest_ai_event")}: </span>
              {latestEvent.label}
            </div>
            <div>
              <span className="font-medium text-gray-900">{t("score")}: </span>
              {(latestEvent.score * 100).toFixed(1)}%
            </div>
            <div>
              <span className="font-medium text-gray-900">{t("event_time")}: </span>
              {formatEventTime(latestEvent.startedAt)}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
          {t("no_ai_event")}
        </div>
      )}
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }
  return createPortal(node, document.body);
}
