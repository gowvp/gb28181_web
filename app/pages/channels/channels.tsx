import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { Popconfirm, Tooltip } from "antd";
import { Cctv, Loader2, Monitor, Search, Server, Wifi } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { GlassButton } from "~/components/ui/glass-button";
import { GlassSearch } from "~/components/ui/glass-search";
import { GlassSegment } from "~/components/ui/glass-segment";
import { cn } from "~/lib/utils";
import { COVER_BLUR_STORAGE_KEY } from "~/components/settings/general_settings";
import { RefreshSnapshot, StopPlay } from "~/service/api/channel/channel";
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

  const [searchKey, setSearchKey] = useState("");
  const [debouncedKey, setDebouncedKey] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKey(searchKey), 500);
    return () => clearTimeout(timer);
  }, [searchKey]);

  const { data, isLoading } = useQuery({
    queryKey: [findDevicesChannelsKey, debouncedKey],
    queryFn: () =>
      FindDevicesChannels({ page: 1, size: 100, key: debouncedKey || undefined }),
    refetchInterval: 10000,
  });

  const detailRef = useRef<any>(null);
  const discoverRef = useRef<any>(null);

  const navigate = useNavigate();

  // Tab 选项：预览、录像、管理
  const options: { label: string; value: string }[] = [
    { label: t("preview"), value: "/nchannels" },
    { label: t("recordings"), value: "/playback" },
    { label: t("management"), value: "/devices" },
  ];

  return (
    <div className="bg-transparent p-4 sm:p-6">
      <div className="mx-auto ">
        {/* 导航工具栏 — macOS 26 Liquid Glass 组件 */}
        <div className="mb-6 flex flex-row gap-2 items-center">
          <GlassSegment
            options={options}
            value="/nchannels"
            onChange={(v) => navigate(v)}
          />

          <Link to="/gb/sip">
            <GlassButton>{t("access_info")}</GlassButton>
          </Link>

          <GlassButton onClick={() => discoverRef.current?.open()}>
            <Wifi className="w-3.5 h-3.5" />
            {t("device_discover")}
          </GlassButton>

          <GlassSearch
            className="ml-auto"
            value={searchKey}
            onChange={setSearchKey}
            onSearch={setDebouncedKey}
            onClear={() => setDebouncedKey("")}
            placeholder={t("search_channel")}
            width={220}
          />
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
        ) : !data?.data.items?.length ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 20px",
              color: "#9ca3af",
            }}
          >
            <Search style={{ width: 32, height: 32, marginBottom: 12, opacity: 0.4 }} />
            <span style={{ fontSize: 14 }}>
              {debouncedKey ? t("no_search_results") : t("no_devices_found")}
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {data.data.items.map((device) => (
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
  isActive,
}: {
  channel: ChannelItem;
  onClick: () => void;
  /** 当前正在播放的通道高亮标识 */
  isActive?: boolean;
}) {
  const { t } = useTranslation("common");
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const queryClient = useQueryClient();
  const coverBlur = localStorage.getItem(COVER_BLUR_STORAGE_KEY) === "true";

  // 停止播放
  const handleStopPlay = async () => {
    setStopping(true);
    try {
      await StopPlay(channel.id);
      queryClient.invalidateQueries({ queryKey: [findDevicesChannelsKey] });
    } finally {
      setStopping(false);
    }
  };

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
    <div
      className={cn(
        "group w-full max-w-[280px] rounded-[20px] overflow-hidden",
        "shadow-[0_4px_16px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.9)]",
        "hover:-translate-y-[3px] hover:scale-[1.01]",
        "hover:shadow-[0_8px_30px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]",
        isActive && "ring-2 ring-blue-500",
      )}
      style={{
        background: "rgba(255, 255, 255, 0.88)",
        border: "1px solid rgba(255, 255, 255, 0.9)",
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <div
        className="bg-slate-100 flex items-center justify-center relative cursor-pointer"
        style={{ aspectRatio: "300/220" }}
        onClick={onClick}
      >
        <img
          src={snapshotUrl || "./assets/imgs/bg.avif"}
          alt="通道预览"
          className="aspect-[4/3] object-cover"
          style={coverBlur ? { filter: "blur(6px)" } : undefined}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "./assets/imgs/bg.avif";
          }}
        />

        {/* Live 标签和状态指示器 */}
        {/* RTSP/RTMP 类型显示 BUSY/IDLE，其他类型显示在线/离线 */}
        <div className="absolute top-2 left-2 flex flex-row gap-2 z-10">
          {channel.type === "RTSP" || channel.type === "RTMP" ? (
            // RTSP/RTMP 类型：BUSY 时可停流
            channel.is_online ? (
              <div
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Popconfirm
                  title={t("stop_play_confirm")}
                  onConfirm={handleStopPlay}
                  okText={t("confirm")}
                  cancelText={t("cancel")}
                  okButtonProps={{ danger: true }}
                >
                  <div className="bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-2xl flex items-center cursor-pointer hover:bg-black/70 transition-colors">
                    {stopping ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <span className="relative flex items-center justify-center mr-1">
                        <span className="absolute w-2 h-2 rounded-full bg-green-500" style={{ animation: "livePulse 2s infinite" }} />
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                      </span>
                    )}
                    <span className="text-xs">BUSY</span>
                  </div>
                </Popconfirm>
              </div>
            ) : (
              <div className="bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-2xl flex items-center">
                <span className="w-2 h-2 rounded-full mr-1 bg-slate-300" />
                <span className="text-xs">IDLE</span>
              </div>
            )
          ) : (
            // 其他类型（GB28181/ONVIF）：显示在线/离线
            <>
              <div className="bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-2xl flex items-center">
                {channel.is_online ? (
                  <span className="relative flex items-center justify-center mr-1">
                    <span className="absolute w-2 h-2 rounded-full bg-green-500" style={{ animation: "livePulse 2s infinite" }} />
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full mr-1 bg-red-500" />
                )}
                <span className="text-xs">
                  {channel.is_online ? t("online") : t("offline")}
                </span>
              </div>

              {channel.is_online &&
                (channel.is_playing ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Popconfirm
                      title={t("stop_play_confirm")}
                      onConfirm={handleStopPlay}
                      okText={t("confirm")}
                      cancelText={t("cancel")}
                      okButtonProps={{ danger: true }}
                    >
                      <div className="bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-2xl flex items-center cursor-pointer hover:bg-black/70 transition-colors">
                        {stopping ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <span className="relative flex items-center justify-center mr-1">
                            <span className="absolute w-2 h-2 rounded-full bg-green-500" style={{ animation: "livePulse 2s infinite" }} />
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                          </span>
                        )}
                        <span className="text-xs">{t("live")}</span>
                      </div>
                    </Popconfirm>
                  </div>
                ) : (
                  <div className="bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-2xl flex items-center">
                    <span className="w-2 h-2 rounded-full mr-1 bg-slate-100" />
                    <span className="text-xs">{t("idle")}</span>
                  </div>
                ))}
            </>
          )}
        </div>

        {/* 悬浮播放按钮：响应外层 group hover，与卡片上浮动画同步 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div
            className="bg-white/85 backdrop-blur-[10px] rounded-full flex items-center justify-center scale-75 group-hover:scale-100 transition-transform duration-[250ms]"
            style={{
              width: 48,
              height: 48,
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            }}
          >
            <svg
              className="w-5 h-5 text-gray-800"
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
            }}
          >
            {channel.name}
          </h4>
          <span
            className="text-xs text-white/90 truncate block"
            style={{
              textShadow:
                "2px 2px 8px rgba(0, 0, 0, 0.5), 1px 1px 6px rgba(0, 0, 0, 0.3), 0.5px 0.5px 4px rgba(0, 0, 0, 0.2)",
            }}
          >
            {channel.channel_id}
          </span>
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
  const navigate = useNavigate();
  const maxChannels = 4;
  const displayChannels = device.children || [];
  const visibleChannels = displayChannels.slice(0, maxChannels);

  return (
    <Card
      className="w-full rounded-[24px]"
      style={{
        background: "rgba(255, 255, 255, 0.82)",
        border: "1px solid rgba(255, 255, 255, 0.7)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.7)",
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
                {(device.ip || device.address) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100/80 border border-gray-200/60 font-mono" style={{ fontSize: 11, color: "#8e8e93" }}>
                    <Server className="w-3 h-3 opacity-60" />
                    {device.ip || device.address}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: "#8e8e93", marginTop: 2 }}>
                {device.device_id}
              </p>
            </div>
          </div>

          {/* 右侧：通道数，点击跳转查看全部 */}
          <Tooltip title="查看全部通道" placement="left">
            <div
              className="flex-shrink-0 text-right cursor-pointer select-none"
              onClick={() => navigate(`/channels?did=${encodeURIComponent(device.id)}`)}
              style={{ padding: "4px 8px", borderRadius: 12, transition: "background 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0.05)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              <div style={{ fontSize: 24, fontWeight: 700, color: "#1d1d1f", letterSpacing: "-0.02em", lineHeight: 1 }}>
                {device.channels ?? displayChannels.length}
              </div>
              <div style={{ fontSize: 11, color: "#aeaeb2", marginTop: 2 }}>通道</div>
            </div>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent>
        {displayChannels.length > 0 ? (
          <div className="flex flex-wrap gap-4">
            {visibleChannels.map((channel) => (
              <div key={channel.id} className="w-[280px] flex-shrink-0">
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
