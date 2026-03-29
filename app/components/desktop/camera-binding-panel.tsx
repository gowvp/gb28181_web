import { Select, Slider, Spin } from "antd";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CameraMarker } from "~/pages/desktop/floor_plan.types";
import type { FlatDeviceChannelOption } from "~/service/api/device/device";

export function CameraBindingPanel({
  camera,
  channelOptions,
  channelsLoading,
  onBindChannel,
  onAngleChange,
  onFovChange,
  onRangeChange,
  onDelete,
}: {
  camera: CameraMarker | null;
  channelOptions: FlatDeviceChannelOption[];
  channelsLoading: boolean;
  onBindChannel: (value: string | null) => void;
  onAngleChange: (value: number) => void;
  onFovChange: (value: number) => void;
  onRangeChange: (value: number) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("desktop");

  if (!camera) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
        {t("no_camera_selected")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-1 text-sm font-semibold text-gray-900">{t("camera_settings")}</div>
        <div className="text-xs text-gray-500">
          {t("position")}: {Math.round(camera.x)}, {Math.round(camera.y)}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-sm font-medium text-gray-900">{t("bind_channel")}</div>
        {channelsLoading ? (
          <div className="flex min-h-14 items-center justify-center">
            <Spin size="small" />
          </div>
        ) : (
          <Select
            className="w-full"
            showSearch
            allowClear
            placeholder={t("bind_channel_placeholder")}
            optionFilterProp="label"
            value={camera.channelId ?? undefined}
            options={channelOptions.map((item) => ({
              value: item.value,
              label: item.searchLabel,
            }))}
            onChange={(value) => onBindChannel(value ?? null)}
          />
        )}
        <div className="mt-2 text-xs text-gray-500">
          {camera.channelName || t("camera_unbound")}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-medium text-gray-900">{t("direction")}</div>
        <Slider min={0} max={359} value={camera.angle} onChange={(value) => onAngleChange(Number(value))} />

        <div className="mb-3 mt-4 text-sm font-medium text-gray-900">{t("fov")}</div>
        <Slider min={20} max={160} value={camera.fov} onChange={(value) => onFovChange(Number(value))} />

        <div className="mb-3 mt-4 text-sm font-medium text-gray-900">{t("range")}</div>
        <Slider min={80} max={800} step={10} value={camera.range} onChange={(value) => onRangeChange(Number(value))} />
      </div>

      <button
        type="button"
        onClick={onDelete}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
      >
        <Trash2 className="h-4 w-4" />
        {t("delete_camera")}
      </button>
    </div>
  );
}
