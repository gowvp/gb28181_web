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
  http_flv?: string;
  /**
   * rtmp 播放地址
   */
  rtmp?: string;
  /**
   * rtsp 播放地址
   */
  rtsp?: string;
  /**
   * websocket flv 播放地址
   */
  ws_flv?: string;
};
