import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button, Radio } from "antd";
import type { CheckboxGroupProps } from "antd/es/checkbox";
import { Cctv, Monitor, Wifi } from "lucide-react";
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
import ChannelDetailView from "./detail";
import DeviceDiscover from "./device_discover";

export default function ChannelsView() {
  const { t } = useTranslation("common");

  // 查询通道树数据
  const { data, isLoading } = useQuery({
    queryKey: [findDevicesChannelsKey],
    queryFn: () => FindDevicesChannels({ page: 1, size: 30 }),
    refetchInterval: 10000,
  });

  const detailRef = useRef<any>(null);
  const discoverRef = useRef<any>(null);

  const navigate = useNavigate();

  const options: CheckboxGroupProps<string>["options"] = [
    { label: t("client_side"), value: "/nchannels" },
    { label: t("management_side"), value: "/devices" },
  ];

  return (
    <div className="min-h-screen bg-transparent p-6">
      <div className="mx-auto ">
        {/* 导航按钮 */}
        <div className="mb-6 flex flex-row gap-2">
          <Radio.Group
            value="/nchannels"
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

          {/* 设备发现按钮 */}
          <Button
            icon={<Wifi className="w-4 h-4" />}
            onClick={() => discoverRef.current?.open()}
          >
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
              <DeviceCard
                key={device.id}
                device={device}
                onChannelClick={(channel) => {
                  detailRef.current?.open(channel);
                }}
              />
            ))}
          </div>
        )}

        <ChannelDetailView ref={detailRef} />
        <DeviceDiscover ref={discoverRef} />
      </div>
    </div>
  );
}

// 通道卡片组件 - 恢复之前的经典设计
function ChannelCard({
  channel,
  onClick,
}: {
  channel: ChannelItem;
  onClick: () => void;
}) {
  const { t } = useTranslation("common");
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  const { data: url } = useQuery({
    queryKey: ["snapshot", channel.id],
    queryFn: () => RefreshSnapshot(channel.id, "", 2592000),
    // enabled: channel.is_online,
    retry: 1,
    // refetchInterval: 120000,
  });

  // 更新 snapshotUrl
  React.useEffect(() => {
    if (url?.data?.link) {
      setSnapshotUrl(url.data.link);
    }
  }, [url]);

  return (
    <div className=" max-w-[300px] max-h-[300px] border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-300 bg-white">
      <div
        className="bg-slate-100 flex items-center justify-center relative cursor-pointer"
        style={{ aspectRatio: "300/220" }}
        onClick={onClick}
      >
        <img
          src={snapshotUrl || "./assets/imgs/bg.avif"}
          alt="通道预览"
          className="aspect-[4/3] object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "./assets/imgs/bg.avif";
          }}
        />

        {/* Live 标签和状态指示器 */}
        {/* 是否在播放 */}
        <div className="absolute top-2 left-2 flex flex-row gap-2">
          <div className="bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-2xl flex items-center">
            <span
              className={`w-2 h-2 rounded-full mr-1 ${
                channel.is_online ? "bg-green-500" : "bg-red-500"
              }`}
            ></span>
            <span className="text-xs">
              {channel.is_online ? t("online") : t("offline")}
            </span>
          </div>

          {channel.is_online && (
            <div className="bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-2xl flex items-center">
              <span
                className={`w-2 h-2 rounded-full mr-1 ${
                  channel.is_playing ? "bg-green-500" : "bg-slate-100"
                }`}
              ></span>
              <span className="text-xs">
                {channel.is_playing ? t("live") : t("idle")}
              </span>
            </div>
          )}
        </div>

        {/* 悬浮播放按钮 */}
        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-all duration-300 flex items-center justify-center opacity-0 hover:opacity-100">
          <div className="bg-white/90 backdrop-blur-sm rounded-full p-3 transform scale-75 hover:scale-100 transition-transform duration-200">
            <svg
              className="w-6 h-6 text-gray-800"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M8 5v10l8-5-8-5z" />
            </svg>
          </div>
        </div>

        {/* 悬浮文字 */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2">
          <h4
            className="text-sm font-semibold truncate text-white mb-1"
            style={{
              textShadow:
                "2px 2px 8px rgba(0, 0, 0, 0.5), 1px 1px 6px rgba(0, 0, 0, 0.3), 0.5px 0.5px 4px rgba(0, 0, 0, 0.2)",
              filter:
                "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3)) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2))",
            }}
          >
            {channel.name}
          </h4>
          <div className="flex items-center justify-between">
            <span
              className="text-xs text-white/90 truncate"
              style={{
                textShadow:
                  "2px 2px 8px rgba(0, 0, 0, 0.5), 1px 1px 6px rgba(0, 0, 0, 0.3), 0.5px 0.5px 4px rgba(0, 0, 0, 0.2)",
                filter:
                  "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3)) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2))",
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

// 设备卡片组件
function DeviceCard({
  device,
  onChannelClick,
}: {
  device: DeviceWithChannelsItem;
  onChannelClick: (channel: ChannelItem) => void;
}) {
  const { t } = useTranslation("common");
  const maxChannels = 4;
  const displayChannels = device.children || [];
  const hasMoreChannels = displayChannels.length > maxChannels; // 显示最多6个通道
  const visibleChannels = displayChannels.slice(0, maxChannels);

  return (
    <Card className="w-full bg-gray-50 border-solid border border-gray-200 rounded-2xl ">
      <CardHeader className="p-2 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cctv
              className={cn(
                "h-6 w-6",
                device.is_online ? "text-gray-600" : "text-red-500",
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
            <div className=" mt-4 text-center">
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
              <div key={channel.id} className="w-[300px] flex-shrink-0">
                <ChannelCard
                  channel={channel}
                  onClick={() => onChannelClick(channel)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-200 rounded-lg">
            <Monitor className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="mb-2">{t("no_channels")}</p>
            {device.type !== "ONVIF" && (
              <p
                className="text-sm text-gray-400"
                dangerouslySetInnerHTML={{
                  __html: t("no_channels_check_config"),
                }}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 设备卡片骨架屏
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

// 导出通道卡片组件供其他文件使用
export { ChannelCard as ChannelCardItem };
