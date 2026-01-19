export type FindDevicesResponse = {
  items: DeviceItem[];
  total: number;
};

// 查询通道树的响应类型
export type FindDevicesChannelsResponse = {
  items: DeviceWithChannelsItem[];
  total: number;
};

// 设备及其通道的类型定义
export type DeviceWithChannelsItem = {
  id: string;
  device_id: string;
  name: string;
  transport: string;
  stream_mode: number;
  ip: string;
  port: number;
  is_online: boolean;
  registered_at: string;
  keepalive_at: string;
  keepalives: number;
  expires: number;
  channels: number;
  created_at: string;
  updated_at: string;
  password: string;
  address: string;
  ext: Ext;
  children: ChannelItem[];
  type: "" | "ONVIF" | "GB28181";
};

// 通道项类型定义
export type ChannelItem = {
  id: string;
  did: string;
  device_id: string;
  channel_id: string;
  name: string;
  ptztype: number;
  is_online: boolean;
  is_playing: boolean; // 是否播放中
  type: string; // 通道类型 (GB28181/ONVIF/RTMP/RTSP)
  app: string; // 应用名 (RTMP/RTSP)
  stream: string; // 流 ID (RTMP/RTSP)
  has_recording: boolean; // 是否存在录像（查询时动态填充）
  ext: Ext;
  created_at: string;
  updated_at: string;
};

export type DeviceItem = {
  channels: number;
  created_at: string;
  device_id: string;
  expires: number;
  ext: Ext;
  id: string;
  ip: string;
  is_online: boolean;
  keepalive_at: string;
  keepalives: number;
  name: string;
  password: string;
  port?: number;
  registered_at?: string;
  stream_mode?: number;
  transport?: string;
  updated_at?: string;
  address?: string;
  type?: string;
  username?: string;
};

export type Ext = {
  firmware: string;
  manufacturer: string;
  model: string;
  name: string;
  gb_version: string;
};

export type GetDeviceResponse = {
  address: string;
  /**
   * 通道数量
   */
  channels: number;
  created_at: string;
  /**
   * 国标设备 id
   */
  device_id: string;
  expires: number;
  ext: Ext;
  id: string;
  ip: string;
  is_online: boolean;
  keepalive_at: string;
  keepalives: number;
  /**
   * 名称
   */
  name: string;
  password: string;
  port: number;
  registered_at: string;
  /**
   * 流模式
   */
  stream_mode: number;
  /**
   * tcp/udp
   */
  transport: string;
  updated_at: string;
  [property: string]: any;
};
