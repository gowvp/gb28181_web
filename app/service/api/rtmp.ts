import { DELETE, GET, POST, PUT } from "../http";
import type { FindRTMPsResponse, RTMPItem } from "../model/rtmp";

export const findRTMPsKey = "rtmps";
// FindRTMPs 查询推流通道列表
export async function FindRTMPs(query: object) {
  return await GET<FindRTMPsResponse>(`/stream_pushs`, query);
}

// AddRTMP 添加推流通道
export async function AddRTMP(data: object) {
  return await POST<RTMPItem>(`/stream_pushs`, data);
}

// DelRTMP 删除推流通道
export async function DelRTMP(id: string) {
  if (id == "") id = "unknown";
  return await DELETE<RTMPItem>(`/stream_pushs/${id}`);
}

// EditRTMP 编辑推流通道
export async function EditRTMP(id: string, value: any) {
  if (id == "") id = "unknown";
  return await PUT<RTMPItem>(`/stream_pushs/${id}`, value);
}
