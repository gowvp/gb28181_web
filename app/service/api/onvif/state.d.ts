/**
 * 添加ONVIF设备请求参数
 */
export interface AddOnvifDeviceRequest {
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
  /** 设备名称 */
  name: string;
  /** IP地址 */
  ip: string;
  /** 端口号 */
  port: number;
}

/**
 * 添加ONVIF设备响应
 */
export interface AddOnvifDeviceResponse {
  // 根据实际响应结构定义
}
