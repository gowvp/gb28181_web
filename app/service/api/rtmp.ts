import { GET, POST } from "../http";
import type { FindRTMPsResponse, RTMPItem } from "../model/rtmp";

// FindRTMPs 查询推流通道列表
export async function FindRTMPs(query: object) {
  return await GET<FindRTMPsResponse>(`/stream_pushs`, query);
}

// AddRTMP 添加推流通道
export async function AddRTMP(data: object) {
  return await POST<RTMPItem>(`/stream_pushs`, data);
}
