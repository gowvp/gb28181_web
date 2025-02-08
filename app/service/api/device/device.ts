import { DELETE, GET, POST, PUT } from "~/service/http";

import type { DeviceItem, FindDevicesResponse } from "./device.d";

export const findDevicesKey = "devices";
// FindDevices 查询设备列表
export async function FindDevices(query: object) {
  return await GET<FindDevicesResponse>(`/devices`, query);
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
