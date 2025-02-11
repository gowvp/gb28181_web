export type FindProxysResponse = {
  items: RTSPItem[];
  total: number;
  [property: string]: any;
};

export type RTSPItem = {
  app: string;
  created_at: string;
  enabled: boolean;
  enabled_audio: boolean;
  enabled_disabled_none_reader: boolean;
  enabled_remove_none_reader: boolean;
  id: string;
  media_server_id: string;
  pulling: boolean;
  source_url: string;
  stream: string;
  stream_key: string;
  timeout_s: number;
  transport: number;
  updated_at: string;
  [property: string]: any;
};
