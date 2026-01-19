/**
 * 录像记录类型定义
 */
export type Recording = {
  /** 录像 ID */
  id: number;
  /** 通道 ID */
  cid: string;
  /** ZLM 应用名 */
  app: string;
  /** ZLM 流 ID */
  stream: string;
  /** 录像开始时间 (毫秒时间戳) */
  started_at: number;
  /** 录像结束时间 (毫秒时间戳) */
  ended_at: number;
  /** 持续时长（秒） */
  duration: number;
  /** 文件相对路径 */
  path: string;
  /** 文件大小（字节） */
  size: number;
  /** AI检测对象数量 */
  object_count: number;
  /** 创建时间 (毫秒时间戳) */
  created_at: number;
  /** 更新时间 (毫秒时间戳) */
  updated_at: number;
};

/**
 * 事件类型（用于时间轴展示）
 */
export type TimelineEvent = {
  /** 事件 ID */
  id: number;
  /** 检测标签 */
  label: string;
  /** 置信度 */
  score: number;
  /** 图片路径 */
  image_path: string;
  /** 事件开始时间 (毫秒时间戳) */
  started_at: number;
};

/**
 * 时间范围类型（用于时间轴）
 */
export type TimeRange = {
  /** 录像记录 ID */
  id: number;
  /** 开始时间 (毫秒时间戳) */
  start_ms: number;
  /** 结束时间 (毫秒时间戳) */
  end_ms: number;
  /** 时长（秒） */
  duration: number;
  /** AI检测对象数量 */
  object_count: number;
  /** 待删除标记（已被标记即将清理） */
  delete_flag: boolean;
};

/**
 * 录像列表查询参数
 */
export type FindRecordingsParams = {
  /** 页码 */
  page?: number;
  /** 每页数量 */
  size?: number;
  /** 通道 ID */
  cid?: string;
  /** 开始时间 (毫秒时间戳) */
  start_ms?: number;
  /** 结束时间 (毫秒时间戳) */
  end_ms?: number;
};

/**
 * 录像列表响应
 */
export type FindRecordingsResponse = {
  items: Recording[];
  total: number;
};

/**
 * 时间轴查询参数
 */
export type TimelineParams = {
  /** 通道 ID */
  cid: string;
  /** 开始时间 (毫秒时间戳) */
  start_ms: number;
  /** 结束时间 (毫秒时间戳) */
  end_ms: number;
};

/**
 * 时间轴响应
 */
export type TimelineResponse = {
  items: TimeRange[];
};

/**
 * 月度统计参数
 */
export type MonthlyParams = {
  /** 通道 ID */
  cid: string;
  /** 年份 */
  year: number;
  /** 月份 (1-12) */
  month: number;
};

/** 月度统计响应 - 返回有录像的位图
 */
export type MonthlyResponse = {
  /** 年份 */
  year: number;
  /** 月份 */
  month: number;
  /** 该月总天数 */
  days: number;
  /** 位图字符串，如 "10101010..." 第 1 天有录像则第 1 位为 1 */
  has_video: string;
};
