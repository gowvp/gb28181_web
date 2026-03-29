import { Spin } from "antd";
import { useTranslation } from "react-i18next";
import type { CameraMarker, LatestCameraEvent } from "~/pages/desktop/floor_plan.types";

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

export function CameraHoverCard({
  camera,
  latestEvent,
  loading,
  x,
  y,
}: {
  camera: CameraMarker;
  latestEvent: LatestCameraEvent | null;
  loading: boolean;
  x: number;
  y: number;
}) {
  const { t } = useTranslation("desktop");

  return (
    <div
      className="pointer-events-none absolute z-20 w-72 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur"
      style={{ left: x, top: y }}
    >
      <div className="mb-2 text-sm font-semibold text-gray-900">
        {camera.channelName || t("camera_unbound")}
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
