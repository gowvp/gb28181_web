export type GetConfigInfoResponse = {
  sip: Sip;
  //   [property: string]: any;
};

export type Sip = {
  /**
   * 国标域 (仅前端显示, 由 id 前 10 位派生)
   */
  domain?: string;
  /**
   * 主机 ip
   */
  host: string;
  /**
   * 国标 id
   */
  id: string;
  /**
   * 全局密码
   */
  password: string;
  /**
   * 端口
   */
  port: number;
  [property: string]: any;
};
