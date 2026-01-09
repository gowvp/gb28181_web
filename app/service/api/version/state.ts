// 版本检查响应
export interface CheckVersionResponse {
  // 是否有新版本
  has_new_version: boolean;
  // 当前版本号
  current_version: string;
  // 新版本号
  new_version: string;
  // 版本描述（Markdown 格式）
  description: string;
}

// SSE 进度事件数据
export interface UpgradeProgressData {
  current: number;
  total: number;
  percent: number;
}

// SSE 消息事件数据
export interface UpgradeMessageData {
  msg: string;
}
