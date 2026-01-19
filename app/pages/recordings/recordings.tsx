import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button, Radio } from "antd";
import type { CheckboxGroupProps } from "antd/es/checkbox";
import { Cctv, Monitor, Video, Wifi } from "lucide-react";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { RefreshSnapshot } from "~/service/api/channel/channel";
import {
  FindDevicesChannels,
  findDevicesChannelsKey,
} from "~/service/api/device/device";
import type {
  ChannelItem,
  DeviceWithChannelsItem,
} from "~/service/api/device/state";

/**
 * 录像页面 - 显示所有通道的预览列表
 * 点击通道卡片跳转到该通道的录像回放详情页
 */
export default function RecordingsView() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  // 查询通道树数据
  const { data, isLoading } = useQuery({
    queryKey: [findDevicesChannelsKey],
    queryFn: () => FindDevicesChannels({ page: 1, size: 30 }),
    refetchInterval: 10000,
  });

  // Tab 选项：预览、录像、管理
  const options: CheckboxGroupProps<string>["options"] = [
    { label: t("preview"), value: "/nchannels" },
    { label: t("recordings"), value: "/playback" },
    { label: t("management"), value: "/devices" },
  ];

  return (
    <div className="min-h-screen bg-transparent p-6">
      <div className="mx-auto">
        {/* 导航按钮 */}
        <div className="mb-6 flex flex-row gap-2">
          <Radio.Group
            value="/playback"
            options={options}
            onChange={(e) => {
              navigate({ to: e.target.value });
            }}
            block
            optionType="button"
            buttonStyle="solid"
          />

          <Link to="/gb/sip">
            <Button>{t("access_info")}</Button>
          </Link>

          <Button icon={<Wifi className="w-4 h-4" />} disabled>
            {t("device_discover")}
          </Button>
        </div>

        {/* Device Cards */}
        {isLoading ? (
          <div className="space-y-1">
            {Array(2)
              .fill(0)
              .map((_, index) => (
                <DeviceCardSkeleton key={index} />
              ))}
          </div>
        ) : (
          <div className="space-y-1">
            {data?.data.items?.map((device) => (
              <RecordingDeviceCard key={device.id} device={device} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 录像通道卡片组件
 * 点击跳转到录像详情页面
 */
function RecordingChannelCard({ channel }: { channel: ChannelItem }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  const { data: url } = useQuery({
    queryKey: ["snapshot", channel.id],
    queryFn: () => RefreshSnapshot(channel.id, "", 2592000),
    retry: 1,
  });

  React.useEffect(() => {
    if (url?.data?.link) {
      setSnapshotUrl(url.data.link);
    }
  }, [url]);

  const hasRecording = channel.has_recording;

  // 点击跳转到录像详情页（仅有录像时）
  const handleClick = () => {
    if (!hasRecording) return;
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${(today.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;
    navigate({
      to: "/playback/detail",
      search: { cid: channel.id, date: dateStr },
    });
  };

  return (
    <div className="max-w-[300px] max-h-[300px] border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-300 bg-white">
      <div
        className={cn(
          "bg-slate-100 flex items-center justify-center relative",
          hasRecording ? "cursor-pointer" : "cursor-default"
        )}
        style={{ aspectRatio: "300/220" }}
        onClick={handleClick}
      >
        <img
          src={snapshotUrl || "./assets/imgs/bg.avif"}
          alt="通道预览"
          className="aspect-4/3 object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "./assets/imgs/bg.avif";
          }}
        />

        {/* 录像标签：有录像蓝色，无录像灰色 */}
        <div className="absolute top-2 left-2 flex flex-row gap-2">
          <div
            className={cn(
              "backdrop-blur-sm text-white px-2 py-1 rounded-2xl flex items-center",
              hasRecording ? "bg-blue-500" : "bg-black/50"
            )}
          >
            <Video className="w-3 h-3 mr-1" />
            <span className="text-xs">{t("recordings")}</span>
          </div>
        </div>

        {/* 悬浮内容：有录像显示播放按钮，无录像显示提示 */}
        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-all duration-300 flex items-center justify-center opacity-0 hover:opacity-100">
          {hasRecording ? (
            <div className="bg-white/90 backdrop-blur-sm rounded-full p-3 transform scale-75 hover:scale-100 transition-transform duration-200">
              <svg
                className="w-6 h-6 text-gray-800"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M8 5v10l8-5-8-5z" />
              </svg>
            </div>
          ) : (
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
              <span className="text-white text-sm">{t("no_recordings")}</span>
            </div>
          )}
        </div>

        {/* 悬浮文字 */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2">
          <h4
            className="text-sm font-semibold truncate text-white mb-1"
            style={{
              textShadow:
                "2px 2px 8px rgba(0, 0, 0, 0.5), 1px 1px 6px rgba(0, 0, 0, 0.3)",
            }}
          >
            {channel.name}
          </h4>
          <div className="flex items-center justify-between">
            <span
              className="text-xs text-white/90 truncate"
              style={{
                textShadow:
                  "2px 2px 8px rgba(0, 0, 0, 0.5), 1px 1px 6px rgba(0, 0, 0, 0.3)",
              }}
            >
              {channel.channel_id}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 录像设备卡片组件
 */
function RecordingDeviceCard({ device }: { device: DeviceWithChannelsItem }) {
  const { t } = useTranslation("common");
  const maxChannels = 4;
  const displayChannels = device.children || [];
  const hasMoreChannels = displayChannels.length > maxChannels;
  const visibleChannels = displayChannels.slice(0, maxChannels);

  return (
    <Card className="w-full bg-gray-50 border-solid border border-gray-200 rounded-2xl">
      <CardHeader className="p-2 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cctv
              className={cn(
                "h-6 w-6",
                device.is_online ? "text-gray-600" : "text-red-500"
              )}
            />
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                {device.ext.name || device.name || t("unnamed_device")}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-600">
                  {device.ext.manufacturer}
                </span>
                {device.ext.gb_version && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    GB28181-{device.ext.gb_version}
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-xs">
                {t("device_id")}: {device.device_id}
              </p>
            </div>
          </div>

          {hasMoreChannels && (
            <div className="mt-4 text-center">
              <span style={{ marginRight: "1rem" }}>
                {t("total_channels")}:
                <span
                  style={{
                    fontWeight: "bold",
                    fontSize: "1.1rem",
                  }}
                >
                  {" "}
                  {device.channels}
                </span>
              </span>

              <Link to="/channels" search={{ device_id: device.device_id }}>
                <Button
                  variant="outlined"
                  size="middle"
                  style={{
                    boxShadow: "none",
                  }}
                >
                  {t("view_more")}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {displayChannels.length > 0 ? (
          <div className="flex flex-wrap gap-4">
            {visibleChannels.map((channel) => (
              <div key={channel.id} className="w-[300px] shrink-0">
                <RecordingChannelCard channel={channel} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-200 rounded-lg">
            <Monitor className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="mb-2">{t("no_channels")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 设备卡片骨架屏
 */
function DeviceCardSkeleton() {
  return (
    <Card className="w-full bg-gray-50 border border-gray-600">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 bg-gray-200 rounded animate-pulse" />
            <div>
              <div className="h-6 bg-gray-200 rounded w-48 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-32 mt-1 animate-pulse" />
            </div>
          </div>
          <div className="h-5 bg-gray-200 rounded w-12 animate-pulse" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(3)
            .fill(0)
            .map((_, index) => (
              <div
                key={index}
                className="border rounded-2xl overflow-hidden bg-white"
              >
                <div
                  className="bg-gray-200 animate-pulse"
                  style={{ aspectRatio: "300/220" }}
                />
                <div className="px-4 py-3 border-t">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-1 animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
