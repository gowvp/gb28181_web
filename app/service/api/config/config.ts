import { GET, POST, PUT } from "~/service/http";
import type { GetConfigInfoResponse } from "./config.d";

export const getConfigInfoKey = "getConfigInfo";
export async function GetConfigInfo() {
  return await GET<GetConfigInfoResponse>(`/configs/info`);
}

export async function SetConfigSIP(values: any) {
  return await PUT(`/configs/info/sip`, values);
}
