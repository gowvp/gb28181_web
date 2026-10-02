import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const code = ts.transpileModule(
  readFileSync(
    new URL("../app/service/api/user/auto_login.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  },
).outputText;

// 执行真实存取函数，仅替换浏览器能力与隔离的本地存储。
function setup(secure, storage = new Map()) {
  const module = { exports: {} };
  vm.runInNewContext(code, {
    exports: module.exports,
    require,
    crypto: secure
      ? webcrypto
      : { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
    TextEncoder,
    TextDecoder,
    Uint8Array,
    btoa,
    atob,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  });
  return { ...module.exports, storage };
}

for (const secure of [false, true]) {
  const environment = secure ? "Web Crypto" : "缺少 crypto.subtle";
  test(`${environment} 保存和读取自动登录凭据`, async () => {
    const api = setup(secure);
    const token = "test-token-中文-🔐";
    await api.saveAutoToken("测试用户", token);
    const first = api.storage.get("GOWVP_AUTO_TOKEN");
    assert.ok(first);
    assert.ok(!first.includes(token));
    assert.equal(await api.loadAutoToken("测试用户"), token);
    await api.saveAutoToken("测试用户", token);
    assert.notEqual(api.storage.get("GOWVP_AUTO_TOKEN"), first);
    api.clearAutoToken();
    assert.equal(await api.loadAutoToken("测试用户"), null);
  });

  test(`${environment} 拒绝错误用户名与篡改密文`, async () => {
    const api = setup(secure);
    await api.saveAutoToken("admin", "test-token");
    assert.equal(await api.loadAutoToken("other-user"), null);
    const [iv, encrypted] = api.storage.get("GOWVP_AUTO_TOKEN").split(".");
    const bytes = Buffer.from(encrypted, "base64");
    bytes[0] ^= 1;
    api.storage.set("GOWVP_AUTO_TOKEN", `${iv}.${bytes.toString("base64")}`);
    assert.equal(await api.loadAutoToken("admin"), null);
  });
}

for (const secure of [false, true]) {
  test(`${secure ? "Web Crypto → 兼容实现" : "兼容实现 → Web Crypto"} 密文互通`, async () => {
    const writer = setup(secure);
    const reader = setup(!secure, writer.storage);
    await writer.saveAutoToken("测试用户", "test-token-中文-🔐");
    assert.equal(await reader.loadAutoToken("测试用户"), "test-token-中文-🔐");
  });
}
