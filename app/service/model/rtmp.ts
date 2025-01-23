export type FindRTMPsResponse = {
  items: RTMPItem[];
  /**
   * 列表总长度
   */
  total: number;
};

export type RTMPItem = {
  /**
   * 应用
   */
  app: string;
  /**
   * 创建时间
   */
  created_at: string;
  /**
   * 唯一标识
   */
  id: string;
  /**
   * 流媒体服务标识
   */
  media_server_id: string;
  /**
   * 别名
   */
  name: string;
  /**
   * 推流时间
   */
  pushed_at: string;
  server_id: string;
  /**
   * 状态,  PUSHING/STOPPED
   */
  status: string;
  /**
   * 停流时间
   */
  stopped_at: string;
  /**
   * 流标识
   */
  stream: string;
  /**
   * 更新时间
   */
  updated_at: string;

  // 推流地址
  push_addrs: string[];

  /**
   * 推流鉴权
   */
  is_auth_disabled: boolean;
};
