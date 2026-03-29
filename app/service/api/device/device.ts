import { DELETE, GET, POST, PUT } from "~/service/config/http";

import type {
  ChannelItem,
  DeviceItem,
  DeviceWithChannelsItem,
  FindDevicesChannelsResponse,
  FindDevicesResponse,
  GetDeviceResponse,
} from "./state";

export const findDevicesKey = "findDevices";
// FindDevices 查询设备列表
export async function FindDevices(query: object) {
  return await GET<FindDevicesResponse>(`/devices`, query);
}

export const findDevicesChannelsKey = "findDevicesChannels";
// FindDevicesChannels 查询通道树
export async function FindDevicesChannels({
  page,
  size,
}: {
  page: number;
  size: number;
}) {
  return await GET<FindDevicesChannelsResponse>(`/devices/channels`, {
    page,
    size,
  });
}

export type FlatDeviceChannelOption = {
  value: string;
  label: string;
  searchLabel: string;
  channelId: string;
  channelName: string;
  deviceId: string;
  deviceName: string;
  did: string;
  isOnline: boolean;
};

export function FlattenDeviceChannels(items: DeviceWithChannelsItem[] = []): FlatDeviceChannelOption[] {
  const result: FlatDeviceChannelOption[] = [];

  for (const device of items) {
    for (const channel of device.children ?? []) {
      result.push(flattenSingleChannel(device, channel));
    }
  }

  return result;
}

function flattenSingleChannel(device: DeviceWithChannelsItem, channel: ChannelItem): FlatDeviceChannelOption {
  const deviceName = device.name || device.device_id || device.id;
  const channelName = channel.name || channel.channel_id || channel.id;
  const label = `${deviceName} / ${channelName}`;
  return {
    value: channel.id,
    label,
    searchLabel: `${label} ${channel.device_id} ${channel.channel_id}`,
    channelId: channel.id,
    channelName,
    deviceId: device.id,
    deviceName,
    did: channel.did,
    isOnline: channel.is_online,
  };
}

export const getDeviceKey = "getDevice";
export async function GetDevice(did: string) {
  if (did === "") {
    did = "unknown";
  }
  return await GET<GetDeviceResponse>(`/devices/${did}`);
}

// AddDevice 添加设备
export async function AddDevice(data: object) {
  return await POST<DeviceItem>(`/devices`, data);
}

// DelDevice 删除设备
export async function DelDevice(id: string) {
  return await DELETE<DeviceItem>(`/devices/${id}`);
}

// EditDevice 编辑设备
export async function EditDevice(id: string, value: any) {
  return await PUT<DeviceItem>(`/devices/${id}`, value);
}

// RefreshCatalog 刷新通道
export async function RefreshCatalog(id: string) {
  return await POST(`/devices/${id}/catalog`);
}
