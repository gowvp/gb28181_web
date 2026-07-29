import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { Cctv, Monitor, Video } from "lucide-react";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { GlassButton } from "~/components/ui/glass-button";
import { GlassSegment } from "~/components/ui/glass-segment";
import { cn } from "~/lib/utils";
import { COVER_BLUR_STORAGE_KEY } from "~/components/settings/general_settings";
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
    queryFn: () => FindDevicesChannels({ page: 1, size: 100 }),
    refetchInterval: 10000,
  });

  // Tab 选项：预览、录像、管理
  const options: { label: string; value: string }[] = [
    { label: t("preview"), value: "/nchannels" },
    { label: t("recordings"), value: "/playback" },
    { label: t("management"), value: "/devices" },
  ];

  return (
    <div className="min-h-screen bg-transparent p-6">
      <div className="mx-auto">
        {/* 导航工具栏 — macOS 26 Liquid Glass */}
        <div className="mb-6 flex flex-row gap-2 items-center">
          <GlassSegment
            options={options}
            value="/playback"
            onChange={(v) => navigate(v)}
          />

          <Link to="/gb/sip">
            <GlassButton>{t("access_info")}</GlassButton>
          </Link>

        </div>

        {/* Device Cards */}
        {isLoading ? (
          <div className="space-y-3">
            {Array(2)
              .fill(0)
              .map((_, index) => (
                <DeviceCardSkeleton key={index} />
              ))}
          </div>
        ) : (
          <div className="space-y-3">
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
  const coverBlur = localStorage.getItem(COVER_BLUR_STORAGE_KEY) === "true";

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
    navigate(
      `/playback/detail?cid=${encodeURIComponent(channel.id)}&date=${encodeURIComponent(dateStr)}`,
    );
  };

  return (
    <div
      className="group w-[280px] rounded-[20px] overflow-hidden hover:-translate-y-[3px] hover:scale-[1.01] shadow-[0_4px_16px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]"
      style={{
        background: "rgba(255, 255, 255, 0.70)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.8)",
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <div
        className={cn(
          "bg-slate-100 flex items-center justify-center relative",
          hasRecording ? "cursor-pointer" : "cursor-default",
        )}
        style={{ aspectRatio: "300/220" }}
        onClick={handleClick}
      >
        <img
          src={snapshotUrl || "./assets/imgs/bg.avif"}
          alt="通道预览"
          className="aspect-4/3 object-cover"
          style={coverBlur ? { filter: "blur(2px)" } : undefined}
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
              hasRecording ? "bg-blue-500" : "bg-black/50",
            )}
          >
            <Video className="w-3 h-3 mr-1" />
            <span className="text-xs">{t("recordings")}</span>
          </div>
        </div>

        {/* 悬浮内容：响应外层 group hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
          {hasRecording ? (
            <div
              className="bg-white/85 backdrop-blur-[10px] rounded-full flex items-center justify-center scale-75 group-hover:scale-100 transition-transform duration-[250ms]"
              style={{ width: 48, height: 48, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}
            >
              <svg
                className="w-5 h-5 text-gray-800"
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
    <Card
      className="w-full rounded-[24px]"
      style={{
        background: "rgba(255, 255, 255, 0.65)",
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
        border: "1px solid rgba(255, 255, 255, 0.6)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)",
      }}
    >
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
              <CardTitle
                style={{
                  fontSize: 16,
                  fontWeight: 650,
                  lineHeight: "22px",
                  color: "#1d1d1f",
                  letterSpacing: "-0.01em",
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {device.ext.name || device.name || t("unnamed_device")}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <span style={{ fontSize: 12, color: "#8e8e93" }}>
                  {device.ext.manufacturer}
                </span>
                {device.ext.gb_version && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800" style={{ fontSize: 11 }}>
                    GB28181-{device.ext.gb_version}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: "#8e8e93", marginTop: 2 }}>
                {device.device_id}
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

              <Link to={`/channels?did=${encodeURIComponent(device.id)}`}>
                <GlassButton variant="ghost" size="sm">
                  {t("view_more")}
                </GlassButton>
              </Link>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {displayChannels.length > 0 ? (
          <div className="flex flex-wrap gap-4">
            {visibleChannels.map((channel) => (
              <div key={channel.id} className="w-[280px] shrink-0">
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
