import { GET, POST, TokenStr } from "../../config/http";
import type {
  LoginRequest,
  LoginResponse,
  PublicKeyResponse,
} from "./state.d.ts";

// 获取 RSA 公钥接口，用于加密登录凭证
export async function getPublicKey(): Promise<PublicKeyResponse> {
  const response = await GET<PublicKeyResponse>("/login/key");
  return response.data;
}

// 使用动态导入加载 node-forge，避免 SSR 模块解析问题
async function encryptWithRSA(
  publicKeyPem: string,
  data: string,
): Promise<string> {
  const forge = (await import("node-forge")).default;
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);

  // 使用 RSA-OAEP + SHA-256 加密（与服务端匹配）
  const encrypted = publicKey.encrypt(data, "RSA-OAEP", {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha256.create() },
  });

  return forge.util.encode64(encrypted);
}

// 登录接口，先获取公钥加密凭证后发送
export async function login(data: {
  username: string;
  password: string;
}): Promise<LoginResponse> {
  // 获取服务器公钥（返回的是 base64 编码的 PEM 字符串）
  const { key: base64PemKey } = await getPublicKey();

  // 解码获取 PEM 格式公钥
  const pemKey = atob(base64PemKey);

  // 构造需要加密的 JSON 字符串
  const credentials = JSON.stringify({
    username: data.username,
    password: data.password,
  });

  // 使用 node-forge 进行 RSA-OAEP 加密
  const encryptedData = await encryptWithRSA(pemKey, credentials);

  // 发送加密后的登录请求
  const response = await POST<LoginResponse>("/login", {
    data: encryptedData,
  } as LoginRequest);
  const result = response.data;

  // 存储token到localStorage
  if (result.token) {
    localStorage.setItem(TokenStr, result.token);
    localStorage.setItem("user", result.user);
  }

  return result;
}

// 登出
export function logout(): void {
  localStorage.removeItem(TokenStr);
  localStorage.removeItem("user");
}

// 获取用户信息
export function getUserInfo(): { username: string; token: string } | null {
  const token = localStorage.getItem(TokenStr);
  const user = localStorage.getItem("user");

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
