import { DELETE, GET, POST, PUT } from "~/service/http";

import type {
  DeviceItem,
  FindDevicesResponse,
  GetDeviceResponse,
} from "./state";

export const findDevicesKey = "findDevices";
// FindDevices 查询设备列表
export async function FindDevices(query: object) {
  return await GET<FindDevicesResponse>(`/devices`, query);
}

export const getDeviceKey = "getDevice";
export async function GetDevice(did: string) {
  if (did == "") {
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
