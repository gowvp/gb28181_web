export declare namespace Device {
  type FindDevicesResponse = {
    items: DeviceItem[];
    total: number;
    [property: string]: any;
  };

  export type DeviceItem = {
    channels?: number;
    created_at?: string;
    device_id?: string;
    expires?: number;
    ext?: Ext;
    id?: string;
    ip?: string;
    is_online?: boolean;
    keepalive_at?: string;
    keepalives?: number;
    name?: string;
    password?: string;
    port?: number;
    registered_at?: string;
    stream_mode?: string;
    trasnport?: string;
    updated_at?: string;
    [property: string]: any;
  };

  export type Ext = {
    firmware: string;
    manufacturer: string;
    model: string;
    [property: string]: any;
  };
}
