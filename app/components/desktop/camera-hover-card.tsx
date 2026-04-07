import { Spin } from "antd";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CameraMarker, LatestCameraEvent } from "~/pages/desktop/floor_plan.types";

const CARD_WIDTH = 288;
const CARD_HEIGHT_ESTIMATE = 280;

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
 * 为什么根据视口裁剪卡片坐标：
 * 绝对定位的悬浮层不参与 Konva 变换，靠右/靠下时若不翻转会被裁切，用户会误以为没有事件图。
 */
function clampCardPosition(
  left: number,
  top: number,
  containerWidth: number,
  containerHeight: number,
) {
  const pad = 8;
  let x = left;
  let y = top;
  if (x + CARD_WIDTH > containerWidth - pad) {
    x = containerWidth - CARD_WIDTH - pad;
  }
  if (y + CARD_HEIGHT_ESTIMATE > containerHeight - pad) {
    y = containerHeight - CARD_HEIGHT_ESTIMATE - pad;
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
 * 为什么 hover 卡片对按钮局部放开 pointer-events：
 * 画布编辑依赖下层 Konva 命中，整张卡片拦截会打断操作；仅「打开录像」需要点击，故只对按钮启用事件。
 */
export function CameraHoverCard({
  camera,
  latestEvent,
  loading,
  anchorX,
  anchorY,
  containerWidth,
  containerHeight,
  onOpenPlayback,
}: {
  camera: CameraMarker;
  latestEvent: LatestCameraEvent | null;
  loading: boolean;
  anchorX: number;
  anchorY: number;
  containerWidth: number;
  containerHeight: number;
  onOpenPlayback?: () => void;
}) {
  const { t } = useTranslation("desktop");

  const { x, y } = clampCardPosition(anchorX + 18, anchorY + 18, containerWidth, containerHeight);
  const canPlayback = Boolean(camera.channelId && onOpenPlayback);

  return (
    <div
      className="pointer-events-none absolute z-20 w-72 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur"
      style={{ left: x, top: y }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 text-sm font-semibold text-gray-900">
          {camera.channelName || t("camera_unbound")}
        </div>
        {canPlayback ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPlayback?.();
            }}
            className="pointer-events-auto inline-flex shrink-0 items-center gap-1 rounded-lg bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-800"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("open_playback")}
          </button>
        ) : null}
      </div>
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
}
