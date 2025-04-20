export type FindMediaServersResponse = {
  items: MediaServer[];
  total: number;
  [property: string]: any;
};

export type MediaServer = {
  auto_config?: boolean;
  created_at?: string;
  hook_alive_interval?: number;
  hook_ip?: string;
  id?: string;
  ip?: string;
  last_keepalive_at?: string;
  ports?: Ports;
  record_assist_port?: number;
  record_day?: number;
  record_path?: string;
  rtpenable?: boolean;
  rtpport_range?: string;
  sdp_ip?: string;
  secret?: string;
  send_rtpport_range?: string;
  status?: boolean;
  stream_ip?: string;
  transcode_suffix?: string;
  type?: string;
  updated_at?: string;
  [property: string]: any;
};

export type Ports = {
  flv: number;
  flvs: number;
  http: number;
  https: number;
  rtmp: number;
  rtmps: number;
  rtpporxy: number;
  rtsp: number;
  rtsps: number;
  ws_flv: number;
  ws_flvs: number;
  [property: string]: any;
};
