export type FindDevicesResponse = {
  items: DeviceItem[];
  total: number;
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
  trasnport?: string;
  updated_at?: string;
  address?: string;
};

export type Ext = {
  firmware: string;
  manufacturer: string;
  model: string;
  name: string;
};
