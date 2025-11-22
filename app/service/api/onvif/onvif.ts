import { POST } from "~/service/config/http";
import type { AddOnvifDeviceRequest, AddOnvifDeviceResponse } from "./state";

/**
 * 添加ONVIF设备
 */
export async function addOnvifDevice(
  data: AddOnvifDeviceRequest
): Promise<AddOnvifDeviceResponse> {
  const res = await POST<AddOnvifDeviceResponse>("/onvif", data);
  return res.data;
}
