import type { decl } from "postcss";

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
};
