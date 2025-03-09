import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "~/components/ui/drawer";
import type { GetDeviceResponse } from "~/service/api/device/device.d";
import { GetDevice, getDeviceKey } from "~/service/api/device/device";
import { ErrorHandle } from "~/service/error";
import { Badge } from "~/components/ui/badge";
import { Button, Radio } from "antd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { FindChannels, findChannelsKey } from "~/service/api/channel/channel";
import { Card } from "~/components/ui/card";
import { ChannelCardItem } from "./channels";

export default function DeviceDetailView({
  ref,
}: {
  ref: React.RefObject<any>;
}) {
  const [did, setDid] = useState("");

  const { data: device, refetch } = useQuery({
    queryKey: [getDeviceKey, did],
    queryFn: () => GetDevice(did),
    enabled: !!did,
  });

  const [filters, setFilters] = useState({ page: 1, size: 200 });
  // 查询数据
  const {
    data: channels,
    isLoading,
    refetch: refetchChannels,
  } = useQuery({
    queryKey: [findChannelsKey, { ...filters, did: did }],
    queryFn: () => FindChannels({ ...filters, did: did }),
    refetchInterval: 10000,
    enabled: false,
  });

  React.useImperativeHandle(ref, () => ({
    showDetail(deviceID: string) {
      if (!deviceID) {
        console.error("设备ID为空");
        return;
      }
      console.log("🚀 ~ showDetail ~ deviceID:", deviceID);
      setDid(deviceID);
      setTimeout(() => refetch(), 0);
    },
  }));

  return (
    <div className="w-[300px]">
      <Tabs defaultValue="device">
        <TabsList className="ml-4">
          <TabsTrigger
            className="data-[state=active]:bg-black data-[state=active]:text-white"
            value="device"
          >
            设备详情
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:bg-black data-[state=active]:text-white"
            value="channels"
            onClick={() => refetchChannels()}
          >
            通道列表
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
                {device?.data.is_online ? "在线" : "离线"}
              </Badge>
            </DrawerTitle>

            <DrawerDescription>{device?.data.device_id}</DrawerDescription>
            <DrawerDescription>
              {`${device?.data.trasnport}://${device?.data.address}`}
            </DrawerDescription>

            <h4 className="py-2">属性</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                厂商:{device?.data.ext.manufacturer}
              </Badge>
              <Badge variant="secondary">模型:{device?.data.ext.model}</Badge>
              <Badge variant="secondary">
                固件:{device?.data.ext.firmware}
              </Badge>
            </div>
          </DrawerHeader>
        </TabsContent>
        <TabsContent value="channels">
          <div className="px-4">
            {channels?.data.items.map((item) => (
              <ChannelCardItem key={item.id} item={item} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
