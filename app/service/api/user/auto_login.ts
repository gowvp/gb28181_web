// 短期自动登录凭据的本地存取
//
// 安全定性（务必知悉）：密钥由用户名派生，而用户名是公开信息，
// 此加密只防"随手翻 DevTools 看到明文 token"，不防针对性解密。
// token 本身可过期、可吊销，风险与现状明文存会话 token 同级。

const AUTO_TOKEN_KEY = "GOWVP_AUTO_TOKEN";
const REMEMBERED_USER_KEY = "GOWVP_USER";

// PBKDF2 固定盐：仅用于派生本地加密密钥，不作为安全边界
const KDF_SALT = "gowvp-auto-login-v1";
const KDF_ITERATIONS = 100_000;
const KEY_BYTES = 32;
const GCM_TAG_BYTES = 16;

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
      iterations: KDF_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: KEY_BYTES * 8 },
    false,
    ["encrypt", "decrypt"],
  );
}

// 普通 HTTP 环境没有 SubtleCrypto；复用已有依赖，保持 PBKDF2 与 AES-GCM 格式一致。
async function createCompatibleCipher(username: string, decrypt = false) {
  const forge = (await import("node-forge")).default;
  const key = await new Promise<string>((resolve, reject) => {
    forge.pkcs5.pbkdf2(
      forge.util.encodeUtf8(username),
      KDF_SALT,
      KDF_ITERATIONS,
      KEY_BYTES,
      forge.md.sha256.create(),
      (error, derived) => {
        if (error) reject(error);
        else resolve(derived);
      },
    );
  });
  const cipher = decrypt
    ? forge.cipher.createDecipher("AES-GCM", key)
    : forge.cipher.createCipher("AES-GCM", key);
  return { forge, cipher };
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
  const iv = crypto.getRandomValues(new Uint8Array(12));
  if (!crypto.subtle) {
    const { forge, cipher } = await createCompatibleCipher(username);
    cipher.start({ iv: String.fromCharCode(...iv) });
    cipher.update(forge.util.createBuffer(token, "utf8"));
    if (!cipher.finish()) throw new Error("自动登录凭据加密失败");
    localStorage.setItem(
      AUTO_TOKEN_KEY,
      `${toBase64(iv.buffer)}.${forge.util.encode64(cipher.output.getBytes() + cipher.mode.tag.getBytes())}`,
    );
    return;
  }
  const key = await deriveKey(username);
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
    if (!crypto.subtle) {
      const { forge, cipher } = await createCompatibleCipher(username, true);
      const encrypted = forge.util.decode64(cipherB64);
      cipher.start({
        iv: forge.util.decode64(ivB64),
        tag: forge.util.createBuffer(encrypted.slice(-GCM_TAG_BYTES)),
      });
      cipher.update(
        forge.util.createBuffer(encrypted.slice(0, -GCM_TAG_BYTES)),
      );
      if (!cipher.finish()) return null;
      return forge.util.decodeUtf8(cipher.output.getBytes());
    }
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
