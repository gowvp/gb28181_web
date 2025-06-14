import { GET, PUT } from "~/service/config/http";

import type { FindMediaServersResponse, MediaServer } from "./state.d";

export const findMediaServersKey = "findMediaServers";
// FindMediaServers 查询流媒体服务器列表
export async function FindMediaServers() {
  return await GET<FindMediaServersResponse>(`/media_servers`);
}

export async function EditMediaServer(id: string, data: object) {
  return await PUT<MediaServer>(`/media_servers/${id}`, data);
}
