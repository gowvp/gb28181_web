import { DELETE, GET, POST, PUT } from "../../config/http";
// import type { FindRTMPsResponse, RTMPItem } from "./rtmp.d";
import type { FindProxysResponse, RTSPItem } from "./state";

export const findProxysKey = "rtsps";
// FindProxys 查询推流通道列表
export async function FindProxys(query: object) {
  return await GET<FindProxysResponse>(`/stream_proxys`, query);
}

// AddProxy 添加推流通道
export async function AddProxy(data: object) {
  return await POST<RTSPItem>(`/stream_proxys`, data);
}

// DelProxy 删除推流通道
export async function DelProxy(id: string) {
  if (id == "") id = "unknown";
  return await DELETE<RTSPItem>(`/stream_proxys/${id}`);
}

// EditProxy 编辑推流通道
export async function EditProxy(id: string, value: any) {
  if (id == "") id = "unknown";
  return await PUT<RTSPItem>(`/stream_proxys/${id}`, value);
}
