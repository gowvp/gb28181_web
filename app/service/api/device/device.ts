import { DELETE, GET, POST, PUT } from "~/service/config/http";
import { FindChannels } from "~/service/api/channel/channel";
import type { ChannelItem as ListChannelItem } from "~/service/api/channel/state";

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

type PagedItemsResponse<T> = {
  data?: {
    items?: T[];
    total?: number;
  };
};

export const findPlannerChannelOptionsKey = "findPlannerChannelOptions";

const PLANNER_DEVICE_PAGE_SIZE = 200;
const PLANNER_CHANNEL_PAGE_SIZE = 500;
const PLANNER_MAX_FETCH_PAGES = 20;

/**
 * 为什么要把分页拉平到一个统一函数里：
 * 2D 视图里的通道绑定必须拿到完整集合，否则多设备场景会表现成“只能选到部分通道”。
 * 把分页终止条件收敛到这里，可以避免不同页面各自手写循环时再次出现漏页、死循环或重复请求。
 */
async function fetchAllPagedItems<T>(
  fetchPage: (page: number, size: number) => Promise<PagedItemsResponse<T>>,
  pageSize: number,
  debugName: string,
): Promise<T[]> {
  const result: T[] = [];

  for (let page = 1; page <= PLANNER_MAX_FETCH_PAGES; page += 1) {
    const response = await fetchPage(page, pageSize);
    const pageItems = response.data?.items ?? [];
    const total = response.data?.total ?? 0;

    result.push(...pageItems);

    if (pageItems.length === 0 || pageItems.length < pageSize || (total > 0 && result.length >= total)) {
      break;
    }
  }

  if (result.length === 0) {
    console.warn(`[floor-plan] ${debugName} returned no items`);
  }

  return result;
}

/**
 * 为什么要把设备显示名解析成独立函数：
 * 设备接口里真正能让现场人员识别位置的名称，经常落在 ext.name 而不是顶层 name。
 * 统一从 name、ext.name 和 device_id 里挑选最有业务语义的值，才能保证所有下游分组和搜索都围绕“人看得懂的设备名”。
 */
function resolveDeviceDisplayName(device: Pick<DeviceItem, "name" | "device_id" | "id" | "ext">): string {
  const topLevelName = device.name?.trim();
  const extName = device.ext?.name?.trim();

  if (topLevelName) {
    return topLevelName;
  }

  if (extName) {
    return extName;
  }

  return device.device_id || device.id;
}

/**
 * 为什么要单独建立设备索引：
 * /channels 接口能返回完整通道列表，但不保证带设备名称。
 * 先把设备列表整理成索引，才能在绑定面板里既看全所有通道，又保留“按设备识别”的操作体验。
 */
function buildDeviceNameIndex(devices: DeviceItem[]): Map<string, string> {
  const result = new Map<string, string>();

  for (const device of devices) {
    const resolvedName = resolveDeviceDisplayName(device);
    result.set(device.id, resolvedName);

    if (device.device_id) {
      result.set(device.device_id, resolvedName);
    }
  }

  return result;
}

/**
 * 为什么要在前端做一次去重和排序：
 * 多页拉取和多协议通道混合返回时，列表稳定性直接影响绑定体验。
 * 这里统一做归一化，能避免同一通道重复出现，也能让用户按设备和通道名更快定位目标。
 */
function flattenChannelsWithDevices(
  channels: ListChannelItem[],
  deviceNameIndex: Map<string, string>,
): FlatDeviceChannelOption[] {
  const deduped = new Map<string, FlatDeviceChannelOption>();

  for (const channel of channels) {
    const deviceName =
      deviceNameIndex.get(channel.did) ||
      deviceNameIndex.get(channel.device_id) ||
      channel.device_id ||
      channel.did ||
      "unknown";
    const channelName = channel.name || channel.channel_id || channel.id;
    const label = `${deviceName} / ${channelName}`;

    deduped.set(channel.id, {
      value: channel.id,
      label,
      searchLabel: `${label} ${channel.device_id || ""} ${channel.channel_id || ""}`.trim(),
      channelId: channel.id,
      channelName,
      deviceId: channel.did || channel.device_id || channel.id,
      deviceName,
      did: channel.did,
      isOnline: channel.is_online,
    });
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const deviceCompare = left.deviceName.localeCompare(right.deviceName, "zh-CN");
    if (deviceCompare !== 0) {
      return deviceCompare;
    }
    return left.channelName.localeCompare(right.channelName, "zh-CN");
  });
}

/**
 * 为什么 2D 视图要改成独立的通道加载函数：
 * /devices/channels 接口为了设备页展示，只返回每个设备的少量 children，天然不适合做“完整通道绑定”。
 * 这里改成“设备列表补名字 + /channels 全量分页补通道”，即使设备很多、通道上百，也能尽量拿全并保住可检索性。
 */
export async function FindPlannerChannelOptions(): Promise<FlatDeviceChannelOption[]> {
  const [devicesResult, channelsResult] = await Promise.allSettled([
    fetchAllPagedItems(
      (page, size) => FindDevices({ page, size }),
      PLANNER_DEVICE_PAGE_SIZE,
      "devices",
    ),
    fetchAllPagedItems(
      (page, size) => FindChannels({ page, size }),
      PLANNER_CHANNEL_PAGE_SIZE,
      "channels",
    ),
  ]);

  const channels = channelsResult.status === "fulfilled" ? channelsResult.value : [];
  const devices = devicesResult.status === "fulfilled" ? devicesResult.value : [];

  if (channelsResult.status === "rejected") {
    console.warn("[floor-plan] failed to load channels for planner", channelsResult.reason);
  }

  if (devicesResult.status === "rejected") {
    console.warn("[floor-plan] failed to load devices for planner", devicesResult.reason);
  }

  if (channels.length > 0) {
    return flattenChannelsWithDevices(channels, buildDeviceNameIndex(devices));
  }

  const fallback = await FindDevicesChannels({ page: 1, size: 500 });
  return FlattenDeviceChannels(fallback.data?.items ?? []);
}

export function FlattenDeviceChannels(items: DeviceWithChannelsItem[] = []): FlatDeviceChannelOption[] {
  const result: FlatDeviceChannelOption[] = [];

  for (const device of items) {
    for (const channel of device.children ?? []) {
      result.push(flattenSingleChannel(device, channel));
    }
  }

  return result;
}

/**
 * 为什么回退分支也要复用同一套设备名解析：
 * 当全量通道接口失败时，界面会退回旧接口；如果这里仍然展示 device_id，用户就会看到前后两套完全不同的分组口径。
 * 保持回退链路和主链路一致，能避免排障时因为展示差异误判成另一类问题。
 */
function flattenSingleChannel(device: DeviceWithChannelsItem, channel: ChannelItem): FlatDeviceChannelOption {
  const deviceName = resolveDeviceDisplayName(device);
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
