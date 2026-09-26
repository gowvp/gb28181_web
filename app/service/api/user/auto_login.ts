// 短期自动登录凭据的本地存取
//
// 安全定性（务必知悉）：密钥由用户名派生，而用户名是公开信息，
// 此加密只防"随手翻 DevTools 看到明文 token"，不防针对性解密。
// token 本身可过期、可吊销，风险与现状明文存会话 token 同级。

const AUTO_TOKEN_KEY = "GOWVP_AUTO_TOKEN";
const REMEMBERED_USER_KEY = "GOWVP_USER";

// PBKDF2 固定盐：仅用于派生本地加密密钥，不作为安全边界
const KDF_SALT = "gowvp-auto-login-v1";

async function deriveKey(username: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(username),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(KDF_SALT),
      iterations: 100_000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

// 加密存储自动登录 token；iv 与密文拼接为 iv.ciphertext 的 base64 形式
export async function saveAutoToken(
  username: string,
  token: string,
): Promise<void> {
  const key = await deriveKey(username);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(token),
  );
  localStorage.setItem(
    AUTO_TOKEN_KEY,
    `${toBase64(iv.buffer)}.${toBase64(cipher)}`,
  );
}

// 读取并解密自动登录 token；不存在或解密失败（用户名变更等）返回 null
export async function loadAutoToken(username: string): Promise<string | null> {
  const raw = localStorage.getItem(AUTO_TOKEN_KEY);
  if (!raw) return null;
  const [ivB64, cipherB64] = raw.split(".");
  if (!ivB64 || !cipherB64) return null;
  try {
    const key = await deriveKey(username);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(ivB64) as BufferSource },
      key,
      fromBase64(cipherB64) as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export function clearAutoToken(): void {
  localStorage.removeItem(AUTO_TOKEN_KEY);
}

export function saveRememberedUser(username: string): void {
  localStorage.setItem(REMEMBERED_USER_KEY, username);
}

export function loadRememberedUser(): string {
  return localStorage.getItem(REMEMBERED_USER_KEY) ?? "";
}
