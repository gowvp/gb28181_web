import { GET, POST, PUT } from "~/service/config/http";
import type { GetConfigInfoResponse } from "./state";

export const getConfigInfoKey = "getConfigInfo";
export async function GetConfigInfo() {
  return await GET<GetConfigInfoResponse>(`/configs/info`);
}

export async function SetConfigSIP(values: any) {
  return await PUT(`/configs/info/sip`, values);
}
