import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const React = require("react");
const ts = require("typescript");
const source = readFileSync(
  new URL("../app/pages/login/login.tsx", import.meta.url),
  "utf8",
);
const origin = "http://gowvp.golang.space:15123";

// 执行登录页真实挂载回调，隔离界面外壳、凭据解密及接口响应。
async function runProbe(baseURL) {
  const effects = [];
  const requests = [];
  const navigations = [];
  const storage = new Map();
  const module = { exports: {} };
  const code = ts.transpileModule(
    source.replace(
      "import.meta.env.VITE_API_BASE_URL",
      JSON.stringify(baseURL),
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    exports: module.exports,
    AbortController,
    Date,
    setTimeout: (callback) => {
      callback();
    },
    localStorage: {
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    fetch: async (url, options) => {
      requests.push({ url: new URL(url, origin), options });
      return { ok: true, status: 200 };
    },
    require(name) {
      if (name === "react")
        return {
          ...React,
          useState: (value) => [
            typeof value === "function" ? value() : value,
            () => {},
          ],
          useRef: (value) => ({ current: value }),
          useEffect: (callback) => effects.push(callback),
        };
      if (name === "react/jsx-runtime") return require(name);
      if (name === "antd")
        return {
          Form: { useForm: () => [{ setFieldsValue() {} }], Item: "FormItem" },
          Input: { Password: "Password" },
          message: { success() {} },
        };
      if (name === "react-router")
        return { useNavigate: () => (path) => navigations.push(path) };
      if (name === "~/service/api/user/auto_login")
        return {
          loadRememberedUser: () => "test-admin",
          loadAutoToken: async () => "isolated-test-token",
        };
      if (name === "~/service/api/metadata/metadata")
        return { GetMetadata: async () => ({ data: { ext: "true" } }) };
      if (name === "~/components/settings/general_settings")
        return { getLoginPageConfig: () => ({}) };
      if (name === "~/service/ws") return { startWs() {} };
      if (name === "~/service/config/http") return { TokenStr: "GOWVP_TOKEN" };
      return new Proxy(
        { __esModule: true, default: "Stub" },
        { get: (target, key) => (key in target ? target[key] : key) },
      );
    },
  });
  module.exports.default();
  effects.at(-1)();
  // 等待挂载回调的异步探针及成功跳转完成。
  for (let i = 0; i < 20; i++) await Promise.resolve();
  return { requests, navigations, storage };
}

for (const [baseURL, expected] of [
  ["/", `${origin}/configs/info`],
  ["/api", `${origin}/api/configs/info`],
  ["/api/", `${origin}/api/configs/info`],
  ["", `${origin}/api/configs/info`],
  ["https://example.com/api/", "https://example.com/api/configs/info"],
]) {
  test(`自动登录基址 ${JSON.stringify(baseURL)} 请求正确的鉴权地址`, async () => {
    const result = await runProbe(baseURL);
    assert.equal(result.requests.length, 1);
    assert.equal(result.requests[0].url.href, expected);
    assert.equal(
      result.requests[0].options.headers.authorization,
      "Bearer isolated-test-token",
    );
    assert.equal(result.requests[0].options.signal.aborted, false);
    assert.deepEqual(result.navigations, ["/desktop"]);
    assert.equal(result.storage.get("GOWVP_TOKEN"), "isolated-test-token");
  });
}
