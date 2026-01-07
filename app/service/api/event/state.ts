/**
 * 事件对象定义
 */
export type Event = {
  /** 事件 ID */
  id: number;
  /** 设备 ID */
  did: string;
  /** 通道 ID */
  cid: string;
  /** 事件开始时间 (毫秒时间戳) */
  started_at: number;
  /** 事件结束时间 (毫秒时间戳) */
  ended_at: number;
  /** 检测标签 (如 person, car) */
  label: string;
  /** 置信度 (0.0-1.0) */
  score: number;
  /** 检测区域 JSON (边界框信息) */
  zones: string;
  /** 图片相对路径，可通过 /events/image/{image_path} 访问 */
  image_path: string;
  /** 分析模型名称 */
  model: string;
  /** 创建时间 (毫秒时间戳) */
  created_at: number;
  /** 更新时间 (毫秒时间戳) */
  updated_at: number;
};

/**
 * 事件列表查询参数
 */
export type FindEventsParams = {
  /** 页码 */
  page?: number;
  /** 每页数量 */
  size?: number;
  /** 排序字段 */
  sort?: string;
  /** 开始时间 (毫秒时间戳) */
  start_ms?: number;
  /** 结束时间 (毫秒时间戳) */
  end_ms?: number;
  /** 设备 ID */
  did?: string;
  /** 通道 ID */
  cid?: string;
  /** 检测标签 */
  label?: string;
};

/**
 * 事件列表响应
 */
export type FindEventsResponse = {
  items: Event[];
  total: number;
};
