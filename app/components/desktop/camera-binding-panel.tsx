import { Input, Select, Slider, Spin } from "antd";
import { Bell, ExternalLink, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CameraMarker, LatestCameraEvent } from "~/pages/desktop/floor_plan.types";
import type { FlatDeviceChannelOption } from "~/service/api/device/device";
import type { FloorPlanInteractionMode } from "~/pages/desktop/floor_plan.storage";

/**
 * 为什么要用“设备名称”而不是 device_id 做分组主键：
 * 现场绑点时，用户识别的是“卖场1、卖场2”这类业务名称，而不是长串国标 ID。
 * 把分组口径改成设备名称，能让多设备场景下的查找路径和用户心智一致，减少误绑和反复展开分组的成本。
 */
function buildGroupedChannelOptions(channelOptions: FlatDeviceChannelOption[]) {
  const grouped = new Map<string, { label: string; options: Array<{ value: string; label: string }> }>();

  for (const item of channelOptions) {
    const groupKey = item.deviceName;
    const group = grouped.get(groupKey) ?? {
      label: item.deviceName,
      options: [],
    };

    group.options.push({
      value: item.value,
      label: `${item.deviceName} / ${item.channelName}`,
    });

    grouped.set(groupKey, group);
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      options: group.options.sort((left, right) => left.label.localeCompare(right.label, "zh-CN")),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
}

/**
 * 为什么摄像头绑定面板要直接暴露加载状态和异常状态：
 * 绑定失败往往不是交互问题，而是后端分页、网络或数据规模导致的数据不完整。
 * 把这些状态留在面板里直接提示，能让现场排查更快定位到“是没加载全”，而不是误判成摄像头或布局有问题。
 */
export function CameraBindingPanel({
  camera,
  channelOptions,
  channelsLoading,
  channelsError,
  onBindChannel,
  onAngleChange,
  onFovChange,
  onRangeChange,
  onDelete,
  interactionMode = "edit",
  channelFilter = "",
  onChannelFilterChange,
  selectedLatestEvent = null,
  selectedEventLoading = false,
  channelOnline = null,
  onOpenPlayback,
  onOpenAlerts,
}: {
  camera: CameraMarker | null;
  channelOptions: FlatDeviceChannelOption[];
  channelsLoading: boolean;
  channelsError: string | null;
  onBindChannel: (value: string | null) => void;
  onAngleChange: (value: number) => void;
  onFovChange: (value: number) => void;
  onRangeChange: (value: number) => void;
  onDelete: () => void;
  interactionMode?: FloorPlanInteractionMode;
  channelFilter?: string;
  onChannelFilterChange?: (value: string) => void;
  selectedLatestEvent?: LatestCameraEvent | null;
  selectedEventLoading?: boolean;
  channelOnline?: boolean | null;
  onOpenPlayback?: () => void;
  onOpenAlerts?: () => void;
}) {
  const { t } = useTranslation("desktop");

  const groupedChannelOptions = useMemo(
    () => buildGroupedChannelOptions(channelOptions),
    [channelOptions],
  );

  const editLocked = interactionMode === "browse";

  return (
    <div className="space-y-4">
      {onChannelFilterChange ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-medium text-gray-900">{t("filter_cameras")}</div>
          <Input
            allowClear
            value={channelFilter}
            placeholder={t("filter_cameras_placeholder")}
            onChange={(e) => onChannelFilterChange(e.target.value)}
          />
          <div className="mt-2 text-xs text-gray-500">{t("filter_cameras_hint")}</div>
        </div>
      ) : null}

      {camera ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-gray-900">{t("panel_latest_ai_event")}</div>
            <div className="flex flex-wrap justify-end gap-1">
              {camera.channelId && onOpenAlerts ? (
                <button
                  type="button"
                  onClick={onOpenAlerts}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700"
                >
                  <Bell className="h-3.5 w-3.5" />
                  {t("open_alerts")}
                </button>
              ) : null}
              {camera.channelId && onOpenPlayback ? (
                <button
                  type="button"
                  onClick={onOpenPlayback}
                  className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-800"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("open_playback")}
                </button>
              ) : null}
            </div>
          </div>
          {selectedEventLoading ? (
            <div className="flex min-h-20 items-center justify-center">
              <Spin size="small" />
            </div>
          ) : selectedLatestEvent ? (
            <div className="space-y-2 text-xs text-gray-600">
              {selectedLatestEvent.imageSrc ? (
                <img
                  src={selectedLatestEvent.imageSrc}
                  alt={selectedLatestEvent.label}
                  className="h-32 w-full rounded-lg border border-gray-200 object-cover"
                  onError={() => {
                    console.warn("[floor-plan] panel event image failed", {
                      channelId: selectedLatestEvent.channelId,
                    });
                  }}
                />
              ) : null}
              <div>
                <span className="font-medium text-gray-900">{t("latest_ai_event")}: </span>
                {selectedLatestEvent.label}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-gray-50 px-3 py-3 text-center text-sm text-gray-500">
              {camera.channelId ? t("no_ai_event") : t("camera_unbound")}
            </div>
          )}
        </div>
      ) : null}

      {!camera ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
          {t("no_camera_selected")}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-1 text-sm font-semibold text-gray-900">{t("camera_settings")}</div>
            <div className="text-xs text-gray-500">
              {t("position")}: {Math.round(camera.x)}, {Math.round(camera.y)}
            </div>
            {camera.channelId != null ? (
              <div className="mt-1 text-xs text-gray-600">
                <span className="font-medium text-gray-900">{t("channel_status")}: </span>
                {channelOnline === null ? t("channel_online_unknown") : channelOnline ? t("channel_online") : t("channel_offline")}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 text-sm font-medium text-gray-900">{t("bind_channel")}</div>
            {channelsLoading ? (
              <div className="flex min-h-14 items-center justify-center">
                <Spin size="small" />
              </div>
            ) : (
              <>
                <Select
                  className="w-full"
                  showSearch
                  allowClear
                  disabled={editLocked}
                  placeholder={t("bind_channel_placeholder")}
                  optionFilterProp="label"
                  value={camera.channelId ?? undefined}
                  options={groupedChannelOptions}
                  onChange={(value) => onBindChannel(value ?? null)}
                />
                <div className="mt-2 text-xs text-gray-500">
                  {t("channel_count_loaded", { count: channelOptions.length })}
                </div>
                {channelsError ? (
                  <div className="mt-1 text-xs text-amber-600">{t("channel_load_warning")}</div>
                ) : null}
              </>
            )}
            <div className="mt-2 text-xs text-gray-500">
              {camera.channelName || t("camera_unbound")}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-medium text-gray-900">{t("direction")}</div>
            <Slider
              min={0}
              max={359}
              disabled={editLocked}
              value={camera.angle}
              onChange={(value) => onAngleChange(Number(value))}
            />

            <div className="mb-3 mt-4 text-sm font-medium text-gray-900">{t("fov")}</div>
            <Slider
              min={20}
              max={160}
              disabled={editLocked}
              value={camera.fov}
              onChange={(value) => onFovChange(Number(value))}
            />

            <div className="mb-3 mt-4 text-sm font-medium text-gray-900">{t("range")}</div>
            <Slider
              min={80}
              max={800}
              step={10}
              disabled={editLocked}
              value={camera.range}
              onChange={(value) => onRangeChange(Number(value))}
            />
          </div>

          <button
            type="button"
            disabled={editLocked}
            onClick={onDelete}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
              editLocked ? "cursor-not-allowed bg-gray-300" : "bg-red-500 hover:bg-red-600"
            }`}
          >
            <Trash2 className="h-4 w-4" />
            {t("delete_camera")}
          </button>
        </>
      )}
    </div>
  );
}
