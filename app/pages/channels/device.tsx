import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Loader2,
  ScanSearch,
  Settings2,
  Video,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import ToolTips from "~/components/xui/tips";
import { PTZPanel } from "~/components/ptz-control/ptz-panel";
import {
  DisableAI,
  EnableAI,
  FindChannels,
  findChannelsKey,
  GetMediaInfo,
  getMediaInfoKey,
  type RecordMode,
  SetRecordMode,
} from "~/service/api/channel/channel";
import type { Ext } from "~/service/api/channel/state";
import { GetDevice, getDeviceKey } from "~/service/api/device/device";
import { ErrorHandle } from "~/service/config/error";
import { ChannelCardItem } from "./channels";

export interface DeviceDetailViewRef {
  showDetail: (deviceID: string) => void;
}

interface DeviceDetailViewProps {
  ref: React.RefObject<DeviceDetailViewRef | null>;
  actionBarPortal?: HTMLDivElement | null;
  channelId?: string;
  /** 设备侧通道编号 */
  channelDeviceId?: string;
  /** 当前通道名称 */
  channelName?: string;
  /** 通道扩展信息，包含 enabled_ai 状态 */
  channelExt?: Ext;
  /** 通道类型 (GB28181/ONVIF/RTMP/RTSP) */
  channelType?: string;
  /** 云台类型 (0=无云台, >0=有云台) */
  channelPtztype?: number;
  onZoneSettings?: () => void;
  /** 通道卡片点击时切换播放，不重新打开窗口 */
  onChannelSwitch?: (channel: any) => void;
}

export default function DeviceDetailView({
  ref,
  actionBarPortal,
  channelId,
  channelDeviceId,
  channelName,
  channelExt,
  channelType,
  channelPtztype,
  onZoneSettings,
  onChannelSwitch,
}: DeviceDetailViewProps) {
  const { t } = useTranslation(["device", "common"]);
  const [did, setDid] = useState("");

  const { data: device, refetch } = useQuery({
    queryKey: [getDeviceKey, did],
    queryFn: () => GetDevice(did),
    enabled: !!did,
  });

  const [filters] = useState({ page: 1, size: 200 });
  // 查询数据
  const { data: channels, refetch: refetchChannels } = useQuery({
    queryKey: [findChannelsKey, { ...filters, did: did }],
    queryFn: () => FindChannels({ ...filters, did: did }),
    refetchInterval: 10000,
    enabled: false,
  });

  React.useImperativeHandle(ref, () => ({
    showDetail(deviceID: string) {
      if (!deviceID) {
        console.error("Device ID is empty");
        return;
      }
      setDid(deviceID);
      setTimeout(() => refetch(), 100);
    },
  }));

  // AI 检测开关状态，初始值从 channelExt 获取
  const [detectEnabled, setDetectEnabled] = useState(
    channelExt?.enabled_ai ?? false,
  );

  // 录像模式状态，初始值从 channelExt 获取，空串默认为 always（全录制）
  const [recordMode, setRecordMode] = useState<RecordMode>(
    channelExt?.record_mode || "always",
  );

  // 当 channelExt 变化时同步状态，确保切换通道时状态正确
  useEffect(() => {
    setDetectEnabled(channelExt?.enabled_ai ?? false);
    setRecordMode(channelExt?.record_mode || "always");
  }, [channelExt?.enabled_ai, channelExt?.record_mode]);

  // 启用 AI 检测
  const { mutate: enableAIMutate, isPending: enablePending } = useMutation({
    mutationFn: () => EnableAI(channelId!),
    onSuccess: (data) => {
      setDetectEnabled(true);
      toast.success(data.data.message || t("common:ai_enabled"), {
        position: "top-right",
      });
    },
    onError: (error) => {
      ErrorHandle(error);
    },
  });

  // 禁用 AI 检测
  const { mutate: disableAIMutate, isPending: disablePending } = useMutation({
    mutationFn: () => DisableAI(channelId!),
    onSuccess: (data) => {
      setDetectEnabled(false);
      toast.success(data.data.message || t("common:ai_disabled"), {
        position: "top-right",
      });
    },
    onError: (error) => {
      ErrorHandle(error);
    },
  });

  // 设置录像模式
  const { mutate: setRecordModeMutate, isPending: recordModePending } =
    useMutation({
      mutationFn: (mode: RecordMode) => SetRecordMode(channelId!, mode),
      onSuccess: (data) => {
        setRecordMode(data.data?.record_mode || "always");
        toast.success(t("common:record_mode_set_success"));
      },
      onError: (error) => {
        ErrorHandle(error);
      },
    });

  const isAIPending = enablePending || disablePending;

  const footerAction = "inline-flex h-6 items-center gap-1 rounded-full border border-black/[0.06] bg-[#f5f5f7] px-2 text-[10px] font-semibold text-[#424245] transition-colors hover:bg-black/[0.06] disabled:opacity-50";

  // 切换 AI 检测状态
  const handleToggleAI = () => {
    if (!channelId || isAIPending) return;
    if (detectEnabled) {
      disableAIMutate();
    } else {
      enableAIMutate();
    }
  };

  return (
    <div className="w-full">
      {/* 操作按钮置于协议栏，避免覆盖视频画面。 */}
      {channelId && (
        <>
          {actionBarPortal && createPortal(
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleAI}
                disabled={isAIPending}
                className={footerAction}
                style={
                  detectEnabled
                    ? {
                        backgroundColor: "#000",
                        borderColor: "#000",
                        color: "#fff",
                      }
                    : undefined
                }
              >
                {isAIPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />}
                {t("common:ai_analysis")}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" disabled={recordModePending} className={footerAction}>
                    {recordModePending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                    {t(`common:record_mode_${recordMode}`)}
                    <ChevronDown className="w-3 h-3 opacity-60 -ml-0.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setRecordModeMutate("always")} className={recordMode === "always" ? "bg-accent" : ""}>{t("common:record_mode_always")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRecordModeMutate("ai")} className={recordMode === "ai" ? "bg-accent" : ""}>{t("common:record_mode_ai")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRecordModeMutate("none")} className={recordMode === "none" ? "bg-accent" : ""}>{t("common:record_mode_none")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button type="button" onClick={onZoneSettings} className={footerAction}>
                <Settings2 className="w-3.5 h-3.5" />
                {t("common:zone_settings")}
              </button>
            </div>,
            actionBarPortal
          )}
          <div className="sm:hidden px-4 pt-4 pb-3">
            <div className="flex gap-2 flex-wrap">
              <ToolTips tips={detectEnabled ? t("common:click_to_disable_ai") : t("common:click_to_enable_ai")}>
                <Button size="sm" variant={detectEnabled ? "default" : "outline"} onClick={handleToggleAI} disabled={isAIPending} className="rounded-full text-[12px]">
                  {isAIPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5 mr-1.5" />}
                  {t("common:ai_analysis")}
                </Button>
              </ToolTips>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={recordModePending} className="rounded-full text-[12px]">
                    {recordModePending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Video className="w-3.5 h-3.5 mr-1.5" />}
                    {t(`common:record_mode_${recordMode}`)}
                    <ChevronDown className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setRecordModeMutate("always")} className={recordMode === "always" ? "bg-accent" : ""}>{t("common:record_mode_always")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRecordModeMutate("ai")} className={recordMode === "ai" ? "bg-accent" : ""}>{t("common:record_mode_ai")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRecordModeMutate("none")} className={recordMode === "none" ? "bg-accent" : ""}>{t("common:record_mode_none")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ToolTips tips={t("common:zone_settings")}>
                <Button size="sm" variant="outline" onClick={onZoneSettings} className="rounded-full text-[12px]">
                  <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                  {t("common:zone_settings")}
                </Button>
              </ToolTips>
            </div>
          </div>
        </>
      )}

      <Tabs defaultValue="device">
        <TabsList className="mx-4 flex h-9 rounded-full bg-black/[0.06] p-[3px]">
          <TabsTrigger
            className="h-[30px] flex-1 rounded-full px-1 text-[13px] font-medium text-[#6e6e73] data-[state=active]:bg-white data-[state=active]:text-[#1d1d1f] data-[state=active]:shadow-[0_1px_4px_rgba(0,0,0,0.08),inset_0_0.5px_0_rgba(255,255,255,0.9)]"
            value="device"
          >
            {t("common:device_detail")}
          </TabsTrigger>
          <TabsTrigger
            className="h-[30px] flex-1 rounded-full px-1 text-[13px] font-medium text-[#6e6e73] data-[state=active]:bg-white data-[state=active]:text-[#1d1d1f] data-[state=active]:shadow-[0_1px_4px_rgba(0,0,0,0.08),inset_0_0.5px_0_rgba(255,255,255,0.9)]"
            value="ptz"
          >
            {t("common:ptz")}
          </TabsTrigger>
          <TabsTrigger
            className="h-[30px] flex-1 rounded-full px-1 text-[13px] font-medium text-[#6e6e73] data-[state=active]:bg-white data-[state=active]:text-[#1d1d1f] data-[state=active]:shadow-[0_1px_4px_rgba(0,0,0,0.08),inset_0_0.5px_0_rgba(255,255,255,0.9)]"
            value="channels"
            onClick={() => refetchChannels()}
          >
            {t("common:channel_list")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="device">
          <div className="px-4 pt-4 pb-4 space-y-4 overflow-hidden">
            {/* 设备属性 — Apple Settings 分组列表 */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold text-[#8e8e93] uppercase tracking-[0.06em] px-1">
                {t("common:device_attributes")}
              </h4>
              <div className="rounded-xl bg-white divide-y divide-black/[0.05]">
                <InfoRow
                  label={device?.data.ext.name || ""}
                  trailing={
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-black/[0.04] text-[10px] text-[#424245]">
                      {device?.data.is_online ? (
                        <span className="relative flex items-center justify-center mr-1">
                          <span className="absolute w-1.5 h-1.5 rounded-full bg-green-500" style={{ animation: "livePulse 2s infinite" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        </span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full mr-1 bg-red-500" />
                      )}
                      {device?.data.is_online ? t("common:online") : t("common:offline")}
                    </span>
                  }
                />
                <InfoRow label="ID" value={device?.data.device_id} />
                <InfoRow label="Host" value={`${device?.data.transport}://${device?.data.address}`} />
              </div>
              <div className="flex flex-wrap gap-1.5 px-1">
                <Badge variant="secondary" className="text-[11px] rounded-full h-[22px] px-2 py-0 font-medium bg-black/[0.04] text-[#424245]">
                  {t("common:vendor")}: {device?.data.ext.manufacturer}
                </Badge>
                <Badge variant="secondary" className="text-[11px] rounded-full h-[22px] px-2 py-0 font-medium bg-black/[0.04] text-[#424245]">
                  {t("common:model")}: {device?.data.ext.model}
                </Badge>
                <Badge variant="secondary" className="text-[11px] rounded-full h-[22px] px-2 py-0 font-medium bg-black/[0.04] text-[#424245]">
                  {t("common:firmware")}: {device?.data.ext.firmware}
                </Badge>
                <Badge variant="secondary" className="text-[11px] rounded-full h-[22px] px-2 py-0 font-medium bg-black/[0.04] text-[#424245]">
                  {t("common:created")}: {device?.data.created_at}
                </Badge>
              </div>
            </div>

            {/* 通道属性 — Apple Settings 分组列表 */}
            {channelId && (
              <div className="space-y-1 pt-8">
                <h4 className="text-[11px] font-semibold text-[#8e8e93] uppercase tracking-[0.06em] px-1">
                  {t("common:channel_attributes")}
                </h4>
                <div className="rounded-xl bg-white divide-y divide-black/[0.05]">
                  {channelName && <InfoRow label={t("common:channel_name")} value={channelName} />}
                  {channelDeviceId && <InfoRow label="ID" value={channelDeviceId} />}
                </div>
                <MediaInfoPanel channelId={channelId} />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ptz">
          {channelId && (
            <div className="px-4 py-4 overflow-hidden">
              <PTZPanel
                channelId={channelId}
                deviceType={channelType || device?.data.type}
                ptztype={channelPtztype}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="channels">
          <div className="px-4 pb-6 space-y-2">
            {channels?.data.items?.map((item) => (
              <ChannelCardItem
                key={item.id}
                channel={{
                  id: item.id,
                  did: item.did,
                  device_id: item.device_id,
                  channel_id: item.channel_id,
                  name: item.name,
                  ptztype: item.ptztype,
                  is_online: item.is_online,
                  is_playing: item.id === channelId,
                  type: item.type || "",
                  app: item.app || "",
                  stream: item.stream || "",
                  has_recording: item.has_recording || false,
                  ext: item.ext,
                  created_at: "",
                  updated_at: "",
                }}
                onClick={() => {
                  if (onChannelSwitch) {
                    onChannelSwitch(item);
                  }
                }}
                isActive={item.id === channelId}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MediaInfoPanel({ channelId }: { channelId: string }) {
  const { t } = useTranslation("common");
  const { data, isLoading, error } = useQuery({
    queryKey: [getMediaInfoKey, channelId],
    queryFn: () => GetMediaInfo(channelId),
    enabled: !!channelId,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="px-4 py-4 text-sm text-gray-400">
        {t("media_info_unavailable")}
      </div>
    );
  }

  const info = data.data;
  const videoTracks = info.tracks?.filter((t) => t.codec_type === 0) ?? [];
  const audioTracks = info.tracks?.filter((t) => t.codec_type === 1) ?? [];

  const formatLoss = (loss: number) => {
    const pct = loss * 100;
    return pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
  };

  return (
    <div className="space-y-3">
      {/* 流信息概要 */}
      {(info.alive_second > 0 || info.reader_count > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {info.alive_second > 0 && (
            <Badge variant="secondary" className="text-[11px] rounded-full h-[22px] px-2 py-0 font-medium bg-black/[0.04] text-[#424245]">
              {t("alive")}: {info.alive_second}s
            </Badge>
          )}
          {info.reader_count > 0 && (
            <Badge variant="secondary" className="text-[11px] rounded-full h-[22px] px-2 py-0 font-medium bg-black/[0.04] text-[#424245]">
              {t("readers")}: {info.reader_count}
            </Badge>
          )}
        </div>
      )}

      {/* 视频轨 */}
      {videoTracks.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[12px] font-semibold text-[#8e8e93] uppercase tracking-[0.04em]">
            {t("video")}
          </h4>
          {videoTracks.map((track, i) => (
            <div key={i} className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[11px] rounded-full h-[22px] px-2 py-0 font-medium bg-black/[0.04] text-[#424245]">{track.codec_id_name}</Badge>
              {track.width > 0 && (
                <Badge variant="secondary" className="text-[11px] rounded-full h-[22px] px-2 py-0 font-medium bg-black/[0.04] text-[#424245]">{track.width}×{track.height}</Badge>
              )}
              {track.fps > 0 && (
                <Badge variant="secondary" className="text-[11px] rounded-full h-[22px] px-2 py-0 font-medium bg-black/[0.04] text-[#424245]">{track.fps} fps</Badge>
              )}
              <Badge variant="secondary" className={`text-[11px] rounded-full h-[22px] px-2 py-0 font-medium bg-black/[0.04] ${track.loss > 0 ? "text-amber-500" : "text-[#424245]"}`}>
                {t("loss")}: {formatLoss(track.loss)}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* 音频轨 */}
      <div className="space-y-1.5">
        <h4 className="text-[12px] font-semibold text-[#8e8e93] uppercase tracking-[0.04em]">
          {t("audio")}
        </h4>
        {audioTracks.length === 0 ? (
          <Badge variant="secondary" className="text-[11px] rounded-full h-[22px] px-2 py-0 font-medium bg-black/[0.04] text-[#424245]">{t("no_audio_track")}</Badge>
        ) : audioTracks.map((track, i) => (
          <div key={i} className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[11px] rounded-full h-[22px] px-2 py-0 font-medium bg-black/[0.04] text-[#424245]">{track.codec_id_name}</Badge>
            {track.sample_rate > 0 && (
              <Badge variant="secondary" className="text-[11px] rounded-full h-[22px] px-2 py-0 font-medium bg-black/[0.04] text-[#424245]">{track.sample_rate} Hz</Badge>
            )}
            {track.channels > 0 && (
              <Badge variant="secondary" className="text-[11px] rounded-full h-[22px] px-2 py-0 font-medium bg-black/[0.04] text-[#424245]">
                {track.channels}ch / {track.sample_bit}bit
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value, trailing }: { label: string; value?: string; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-[14px] py-[10px] min-h-[38px]">
      <span className="text-[13px] text-[#1d1d1f] font-medium shrink-0 mr-3">{label}</span>
      {trailing || (
        <span className="text-[12px] text-[#6e6e73] text-right break-all leading-tight">{value}</span>
      )}
    </div>
  );
}
