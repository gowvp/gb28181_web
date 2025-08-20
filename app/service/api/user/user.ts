import type { LoginRequest, LoginResponse } from './state.d.ts';
import { POST } from '../../config/http';
import { TokenStr } from '../../config/http';

// 登录接口
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await POST<LoginResponse>('/user/login', data);
  const result = response.data;

  // 存储token到localStorage
  if (result.token) {
    localStorage.setItem(TokenStr, result.token);
    localStorage.setItem('user', result.user);
  }

  return result;
}

// 登出
export function logout(): void {
  localStorage.removeItem(TokenStr);
  localStorage.removeItem('user');
}

// 获取用户信息
export function getUserInfo(): { username: string; token: string } | null {
  const token = localStorage.getItem(TokenStr);
  const user = localStorage.getItem('user');

  if (token && user) {
    return { username: user, token };
  }

  return null;
}

// 检查是否已登录
export function isLoggedIn(): boolean {
  const token = localStorage.getItem(TokenStr);
  return !!token;
}

// 获取token
export function getToken(): string | null {
  return localStorage.getItem(TokenStr);
}
