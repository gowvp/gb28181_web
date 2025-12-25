// 用户相关类型定义
export interface LoginRequest {
  // 加密后的 base64 字符串，包含加密的用户名和密码
  data: string;
}

// 获取公钥响应
export interface PublicKeyResponse {
  key: string;
}

export interface LoginResponse {
  token: string;
  user: string;
}

export interface UserInfo {
  username: string;
  token: string;
}

// 用户状态
export interface UserState {
  userInfo: UserInfo | null;
  isLoggedIn: boolean;
  loading: boolean;
}
