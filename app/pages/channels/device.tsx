import { useQuery } from "@tanstack/react-query";
import { ScanSearch, Settings2 } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "~/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import ToolTips from "~/components/xui/tips";
import { FindChannels, findChannelsKey } from "~/service/api/channel/channel";
import { GetDevice, getDeviceKey } from "~/service/api/device/device";
import { ChannelCardItem } from "./channels";

export interface DeviceDetailViewRef {
  showDetail: (deviceID: string) => void;
}

interface DeviceDetailViewProps {
  ref: React.RefObject<DeviceDetailViewRef | null>;
  channelId?: string;
  onZoneSettings?: () => void;
}

export default function DeviceDetailView({
  ref,
  channelId,
  onZoneSettings,
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

  const [detectEnabled, setDetectEnabled] = useState(false);

  return (
    <div className="w-[300px]">
      {/* 检测和区域设置按钮 */}
      {channelId && (
        <>
          <div className="flex gap-2 p-4 pb-3">
            <ToolTips tips={t("common:detection")}>
              <Button
                size="sm"
                variant={detectEnabled ? "default" : "outline"}
                onClick={() => {
                  toast.info(t("common:developing"));
                  setDetectEnabled(!detectEnabled);
                }}
              >
                <ScanSearch className="w-4 h-4 mr-1" />
                {t("common:detection")}
              </Button>
            </ToolTips>
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
            value="channels"
            onClick={() => refetchChannels()}
          >
            {t("common:channel_list")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="device">
          {/* <h3>国标设备</h3> */}
          <DrawerHeader className="pt-2">
            <DrawerTitle className="flex items-center">
              <span>{device?.data.ext.name}</span>
              <Badge
                variant="secondary"
                className={`ml-2 ${
                  device?.data.is_online ? "bg-green-300" : "bg-orange-300"
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

            <h4 className="py-2">{t("common:attributes")}</h4>
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
                  ext: item.ext,
                  created_at: "",
                  updated_at: "",
                  is_playing: false,
                }}
                onClick={() => {
                  // 处理通道点击事件
                  console.log(`${t("common:click_channel")}:`, item.name);
                }}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
