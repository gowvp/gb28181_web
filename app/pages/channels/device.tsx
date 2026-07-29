import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Loader2,
  ScanSearch,
  Settings2,
  Video,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "~/components/ui/drawer";
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
  channelId?: string;
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
  channelId,
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
      toast.success(data.data.message || t("common:ai_enabled"));
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
      toast.success(data.data.message || t("common:ai_disabled"));
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
    <div className="w-[300px]">
      {/* AI分析、录像设置和区域设置按钮 */}
      {channelId && (
        <>
          <div className="flex gap-2 p-4 pb-3 flex-wrap">
            <ToolTips
              tips={
                detectEnabled
                  ? t("common:click_to_disable_ai")
                  : t("common:click_to_enable_ai")
              }
            >
              <Button
                size="sm"
                variant={detectEnabled ? "default" : "outline"}
                onClick={handleToggleAI}
                disabled={isAIPending}
              >
                {isAIPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <ScanSearch className="w-4 h-4 mr-1" />
                )}
                {t("common:ai_analysis")}
              </Button>
            </ToolTips>

            {/* 录像设置下拉按钮 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={recordModePending}
                >
                  {recordModePending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Video className="w-4 h-4 mr-1" />
                  )}
                  {t(`common:record_mode_${recordMode}`)}
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => setRecordModeMutate("always")}
                  className={recordMode === "always" ? "bg-accent" : ""}
                >
                  {t("common:record_mode_always")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setRecordModeMutate("ai")}
                  className={recordMode === "ai" ? "bg-accent" : ""}
                >
                  {t("common:record_mode_ai")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setRecordModeMutate("none")}
                  className={recordMode === "none" ? "bg-accent" : ""}
                >
                  {t("common:record_mode_none")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ToolTips tips={t("common:zone_settings")}>
              <Button size="sm" variant="outline" onClick={onZoneSettings}>
                <Settings2 className="w-4 h-4 mr-1" />
                {t("common:zone_settings")}
              </Button>
            </ToolTips>
          </div>
          <div className="border-b border-dashed border-gray-200 mb-2 mx-4" />
        </>
      )}

      <Tabs defaultValue="device">
        <TabsList className="ml-4">
          <TabsTrigger
            className="data-[state=active]:bg-black data-[state=active]:text-white"
            value="device"
          >
            {t("common:device_detail")}
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:bg-black data-[state=active]:text-white"
            value="ptz"
          >
            {t("common:ptz")}
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:bg-black data-[state=active]:text-white"
            value="channels"
            onClick={() => refetchChannels()}
          >
            {t("common:channel_list")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="device">
          <DrawerHeader className="pt-2">
            <DrawerTitle className="flex items-center">
              <span>{device?.data.ext.name}</span>
              <Badge
                variant="secondary"
                className={`ml-2 ${
                  device?.data.is_online ? "bg-green-300" : "bg-red-400"
                } text-white`}
              >
                {device?.data.is_online
                  ? t("common:online")
                  : t("common:offline")}
              </Badge>
            </DrawerTitle>

            <DrawerDescription>{device?.data.device_id}</DrawerDescription>
            <DrawerDescription>
              {`${device?.data.transport}://${device?.data.address}`}
            </DrawerDescription>

            <h4 className="pt-3 pb-1 text-sm font-medium">{t("common:device_attributes")}</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {t("common:vendor")}:{device?.data.ext.manufacturer}
              </Badge>
              <Badge variant="secondary">
                {t("common:model")}:{device?.data.ext.model}
              </Badge>
              <Badge variant="secondary">
                {t("common:firmware")}:{device?.data.ext.firmware}
              </Badge>
              <Badge variant="secondary">
                {t("common:created")}:{device?.data.created_at}
              </Badge>
            </div>
          </DrawerHeader>

          {channelId && (
            <>
              {channelName && (
                <h4 className="px-4 pt-2 pb-1 text-sm font-medium">
                  {t("common:channel_name")}: {channelName}
                </h4>
              )}
              <MediaInfoPanel channelId={channelId} />
            </>
          )}
        </TabsContent>

        <TabsContent value="ptz">
          {channelId && (
            <div className="px-4 py-4">
              <PTZPanel
                channelId={channelId}
                deviceType={channelType || device?.data.type}
                ptztype={channelPtztype}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="channels">
          <div className="px-4 space-y-2">
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
  const sortedTracks = [...videoTracks, ...audioTracks];

  const formatLoss = (loss: number) => {
    const pct = loss * 100;
    return pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
  };

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {info.alive_second > 0 && (
          <Badge variant="secondary">
            {t("alive")}: {info.alive_second}s
          </Badge>
        )}
        {info.reader_count > 0 && (
          <Badge variant="secondary">
            {t("readers")}: {info.reader_count}
          </Badge>
        )}
      </div>

      {sortedTracks.map((track, i) => (
        <div
          key={i}
          className="rounded-lg border border-gray-100 p-3 space-y-1.5"
        >
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {track.codec_type === 0 ? t("video") : t("audio")}
            </Badge>
            <span className="text-sm font-medium">{track.codec_id_name}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {track.codec_type === 0 && track.width > 0 && (
              <span>
                {track.width}×{track.height}
              </span>
            )}
            {track.codec_type === 0 && track.fps > 0 && (
              <span>{track.fps} fps</span>
            )}
            {track.codec_type === 0 && (
              <span className={track.loss > 0 ? "text-amber-500" : ""}>
                {t("loss")}: {formatLoss(track.loss)}
              </span>
            )}
            {track.codec_type === 1 && track.sample_rate > 0 && (
              <span>{track.sample_rate} Hz</span>
            )}
            {track.codec_type === 1 && track.channels > 0 && (
              <span>
                {track.channels}ch / {track.sample_bit}bit
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
