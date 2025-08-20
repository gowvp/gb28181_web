// 用户相关类型定义
export interface LoginRequest {
  username: string;
  password: string;
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
