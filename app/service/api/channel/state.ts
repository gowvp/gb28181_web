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
  type: string; // 通道类型 (GB28181/ONVIF/RTMP/RTSP)
  app: string; // 应用名 (RTMP/RTSP)
  stream: string; // 流 ID (RTMP/RTSP)
  config: StreamConfig; // 流配置 (RTMP/RTSP)
  created_at: string;
  updated_at: string;
};

/**
 * 流配置（用于 RTMP 推流和 RTSP 拉流代理）
 */
export type StreamConfig = {
  // RTMP 推流配置
  is_auth_disabled?: boolean; // 是否禁用推流鉴权
  pushed_at?: string; // 最后推流时间
  stopped_at?: string; // 最后停止时间
  media_server_id?: string; // 媒体服务器 ID

  // RTSP 拉流配置
  source_url?: string; // 原始 URL
  transport?: number; // 拉流方式 (0:tcp, 1:udp)
  timeout_s?: number; // 超时时间
  enabled_audio?: boolean; // 是否启用音频
  enabled_remove_none_reader?: boolean; // 无人观看时删除
  enabled_disabled_none_reader?: boolean; // 无人观看时禁用
  stream_key?: string; // ZLM 返回的 key
  enabled?: boolean; // 是否启用
};

export type Ext = {
  firmware: string;
  manufacturer: string;
  model: string;
  name: string;
  gb_version: string;
  /** 是否启用 AI 检测 */
  enabled_ai?: boolean;
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
  /** 应用的算法标签列表 */
  labels?: string[];
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
  /** 应用的算法标签列表 */
  labels?: string[];
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

/**
 * 启用 AI 检测响应
 */
export type EnableAIResponse = {
  /** 是否已启用 */
  enabled: boolean;
  /** 消息 */
  message: string;
  /** 视频源宽度 */
  source_width?: number;
  /** 视频源高度 */
  source_height?: number;
  /** 视频源帧率 */
  source_fps?: number;
};

/**
 * 禁用 AI 检测响应
 */
export type DisableAIResponse = {
  /** 是否已启用 */
  enabled: boolean;
  /** 消息 */
  message: string;
};

/**
 * 添加通道请求参数 (RTMP/RTSP)
 */
export type AddChannelInput = {
  /** 通道类型 (RTMP/RTSP) */
  type: "RTMP" | "RTSP";
  /** 通道名称 */
  name: string;
  /** 可选，关联的父设备 ID */
  device_id?: string;
  /** 可选，device_id 不存在时用于创建新设备 */
  device_name?: string;
  /** 应用名 */
  app: string;
  /** 流 ID */
  stream: string;
  /** 流配置 */
  config?: StreamConfig;
};

/**
 * 添加通道响应
 */
export type AddChannelResponse = ChannelItem;

/**
 * 编辑通道请求参数
 */
export type EditChannelInput = {
  /** 通道名称 */
  name?: string;
  /** 应用名 */
  app?: string;
  /** 流 ID */
  stream?: string;
  /** 流配置 */
  config?: StreamConfig;
};

/**
 * 编辑通道响应
 */
export type EditChannelResponse = ChannelItem;
