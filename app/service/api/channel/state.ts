/**
 * Request
 */
export type PlayResponse = {
  app: string;
  items: PlayItem[];
  stream: string;
};

export type PlayItem = {
  /**
   * http flv 播放地址
   */
  http_flv: string;
  /**
   * rtmp 播放地址
   */
  rtmp: string;
  /**
   * rtsp 播放地址
   */
  rtsp: string;
  /**
   * websocket flv 播放地址
   */
  ws_flv: string;

  // 标签
  label: string;

  /**
   * webrtc 播放地址
   */
  webrtc: string;

  /**
   * hls 播放地址
   */
  hls: string;
};

export type FindChannelsResponse = {
  items: ChannelItem[];
  total: number;
};

export type ChannelItem = {
  channel_id: string;
  device_id: string;
  did: string;
  ext: Ext;
  id: string;
  is_online: boolean;
  name: string;
  ptztype: number;
};

export type Ext = {
  firmware: string;
  manufacturer: string;
  model: string;
  name: string;
  gb_version: string;
};

export type RefreshSnapshotResponse = {
  link: string;
};

/**
 * 区域定义
 */
export type Zone = {
  /** 区域名称 */
  name: string;
  /** 归一化坐标数组，格式: [x1, y1, x2, y2, ...] */
  coordinates: number[];
  /** 颜色值，支持 hex 格式 */
  color: string;
};

/**
 * 添加区域请求参数
 */
export type AddZoneInput = {
  /** 区域名称 */
  name: string;
  /** 归一化坐标数组 */
  coordinates: number[];
  /** 颜色值 */
  color: string;
};

/**
 * 获取区域列表响应
 */
export type GetZonesResponse = Zone[];

/**
 * 添加区域响应
 */
export type AddZoneResponse = {
  items: Zone;
};
