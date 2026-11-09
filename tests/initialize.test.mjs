import assert from "node:assert/strict";
import { constants, generateKeyPairSync, privateDecrypt } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const setupInfo = () => ({
  need_init: true,
  sip: { host: "192.0.2.2", port: 17060, id: "34020000002000000001" },
  onvif: { username: "nvr" },
  media: { sdp_ip: "192.0.2.8", type: "zlm" },
  firewall: [
    {
      id: "rtp",
      label: "RTP 收流",
      ports: "31001-31100",
      protocols: ["UDP", "TCP"],
      direction: "设备 → 媒体节点",
      condition: "按需收流",
      description: "动态分配",
    },
    {
      id: "rtsp",
      label: "RTSP",
      ports: "554",
      protocols: ["TCP"],
      direction: "客户端 → 媒体节点",
      condition: "ONVIF 播放",
      description: "核对实际媒体配置",
    },
  ],
  notes: ["仅展示，不修改防火墙或安全组"],
});

function load(path, overrides = {}, globals = {}) {
  const slots = [];
  let cursor = 0;
  const effects = [],
    changes = [],
    validations = [],
    notifications = [];
  const module = { exports: {} };
  const values = {};
  const form = {
    values,
    rejectNext: false,
    resetFields() {
      for (const key of Object.keys(values)) delete values[key];
    },
    getFieldValue(key) {
      return values[key];
    },
    setFieldsValue(data) {
      Object.assign(values, data);
    },
    async validateFields(fields) {
      validations.push(fields);
      if (form.rejectNext) {
        form.rejectNext = false;
        throw new Error("invalid field");
      }
      return { ...values };
    },
  };
  const source = readFileSync(
    new URL(path, import.meta.url),
    "utf8",
  ).replaceAll("import.meta.env.VITE_API_BASE_URL", '"/api"');
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const hooks = {
    ...React,
    useState(initial) {
      const i = cursor++;
      if (!(i in slots))
        slots[i] = typeof initial === "function" ? initial() : initial;
      return [
        slots[i],
        (value) => {
          slots[i] = typeof value === "function" ? value(slots[i]) : value;
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useCallback: (fn) => fn,
    useEffect: (fn) => {
      effects.push(fn);
    },
  };
  vm.runInNewContext(code, {
    ...globals,
    exports: module.exports,
    TextEncoder,
    AbortController,
    atob,
    btoa,
    localStorage: {
      setItem: (...args) => changes.push(["set", ...args]),
      removeItem: (...args) => changes.push(["remove", ...args]),
    },
    require(name) {
      if (name in overrides) return overrides[name];
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return require(name);
      if (name === "antd")
        return {
          Form: Object.assign("Form", { useForm: () => [form], Item: "Item" }),
          Input: { Password: "Password" },
          message: {
            success(value) {
              notifications.push(["success", value]);
            },
            info(value) {
              notifications.push(["info", value]);
            },
          },
        };
      if (name === "~/components/settings/general_settings")
        return {
          getLoginPageConfig: () => ({}),
          LOGIN_PAGE_KEY: "login_page",
          syncDocumentTitle() {},
        };
      return new Proxy(
        { __esModule: true, default: name },
        { get: (target, key) => (key in target ? target[key] : key) },
      );
    },
  });
  return {
    exports: module.exports,
    effects,
    changes,
    validations,
    notifications,
    form,
    render(props) {
      cursor = 0;
      return module.exports.default(props);
    },
  };
}
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

test("功能介绍仅展示开源功能卡片，由开始使用按钮关闭", () => {
  let started = 0;
  const app = load("../app/pages/login/features-modal.tsx", {
    antd: { Modal: "Modal" },
  });
  const tree = app.render({ open: true, onStart: () => started++ });
  assert.equal(tree.type, "Modal");
  assert.equal(tree.props.open, true);
  assert.doesNotMatch(text(tree), /初始化完成|初始化已完成/);
  const list = find(tree, (n) => n.props?.["aria-label"] === "平台功能");
  const cards = list.props.children;
  assert.equal(cards.length, 8);
  for (const card of cards) {
    assert.equal(card.type, "li");
    assert.equal(card.props.onClick, undefined);
    assert.equal(card.props.tabIndex, undefined);
    assert.equal(
      find(card, (n) => n.type === "a" || n.type === "button"),
      null,
    );
  }
  const titles = Array.from(
    cards,
    (card) => find(card, (n) => n.type === "h3").props.children,
  );
  assert.deepEqual(titles, [
    "Home Assistant",
    "GB28181",
    "ONVIF",
    "RTMP",
    "RTSP",
    "多协议播放",
    "云端录像",
    "AI 分析与告警",
  ]);
  assert.equal(started, 0);
  find(tree, (n) => n.props?.children === "开始使用").props.onClick();
  assert.equal(started, 1);
  assert.equal(app.render({ open: false, onStart() {} }).props.open, false);
});

test("完成动画两秒后通知展示特性，离开页面会取消计时", () => {
  let timer,
    delay,
    cleared,
    completed = 0;
  const app = load(
    "../app/pages/login/completion-animation.tsx",
    {
      antd: { Modal: "Modal" },
    },
    {
      window: {
        setTimeout(callback, ms) {
          timer = callback;
          delay = ms;
          return 7;
        },
        clearTimeout(id) {
          cleared = id;
        },
      },
    },
  );
  const tree = app.render({ onComplete: () => completed++ });
  assert.ok(find(tree, (n) => n.props?.role === "status"));
  const cleanup = app.effects[0]();
  assert.equal(delay, 2000);
  assert.equal(completed, 0);
  timer();
  assert.equal(completed, 1);
  cleanup();
  assert.equal(cleared, 7);
});
function find(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const result = find(child, predicate);
    if (result) return result;
  }
  return null;
}
function text(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return "";
  return [node.props?.children].flat(Infinity).map(text).join(" ");
}

test("初始化状态加载只显示旋转动画，保留屏幕阅读器提示", () => {
  const app = load("../app/pages/login/login.tsx");
  const status = find(app.render(), (n) => n.props?.role === "status");
  assert.equal(status.props["aria-label"], "正在加载初始化状态");
  assert.equal(status.props["aria-busy"], true);
  assert.equal(text(status).trim(), "");
  const spinner = find(
    status,
    (n) => n.props?.["data-testid"] === "init-loading-spinner",
  );
  assert.ok(spinner);
  assert.equal(spinner.props["aria-hidden"], "true");
  assert.match(spinner.props.className, /animate-spin/);
});

test("独立 GET /init 控制初始化，成功后点击开始使用才进入登录", async () => {
  let resolve;
  const pending = new Promise((r) => {
    resolve = r;
  });
  let cleared = 0,
    appearanceCalls = 0;
  const app = load("../app/pages/login/login.tsx", {
    "~/service/api/user/user": { getInitialization: () => pending },
    "~/service/api/metadata/metadata": {
      GetMetadata: async () => {
        appearanceCalls++;
        throw new Error("appearance unavailable");
      },
    },
    "~/service/api/user/auto_login": {
      clearAutoToken: () => {
        cleared++;
      },
    },
  });
  assert.ok(find(app.render(), (n) => n.props?.role === "status"));
  app.effects[0]();
  app.effects[1]();
  await flush();
  assert.ok(find(app.render(), (n) => n.props?.role === "status"));
  resolve(setupInfo());
  await flush();
  const setup = app.render();
  assert.equal(setup.type, "./initialize");
  assert.equal(setup.props.info.sip.port, 17060);
  assert.equal(appearanceCalls, 1);
  setup.props.onSuccess("operator");
  const completed = app.render();
  assert.equal(
    find(completed, (n) => n.type === app.exports.LoginFormView),
    null,
  );
  const animation = find(completed, (n) => n.type === "./completion-animation");
  assert.ok(animation);
  assert.equal(
    find(completed, (n) => n.type === "./features-modal"),
    null,
  );
  animation.props.onComplete();
  const features = find(app.render(), (n) => n.type === "./features-modal");
  assert.ok(features);
  assert.equal(features.props.open, true);
  assert.equal(
    find(app.render(), (n) => n.type === app.exports.LoginFormView),
    null,
  );
  assert.equal(cleared, 1);
  assert.ok(
    app.changes.some(([op, key]) => op === "remove" && key === "TokenStr"),
  );
  features.props.onStart();
  assert.equal(
    find(app.render(), (n) => n.type === "./features-modal"),
    null,
  );
  const login = find(app.render(), (n) => n.type === app.exports.LoginFormView);
  assert.ok(login);
  assert.equal(login.props.initialUsername, "operator");
  animation.props.onComplete();
  assert.ok(find(app.render(), (n) => n.type === app.exports.LoginFormView));
  assert.equal(
    find(app.render(), (n) => n.type === "./features-modal"),
    null,
  );
});

test("保存成功后迟到的初始化检查不会绕过开始使用按钮", async () => {
  let resolveLate;
  let checks = 0;
  const app = load("../app/pages/login/login.tsx", {
    "~/service/api/user/user": {
      getInitialization: () =>
        ++checks === 1
          ? Promise.resolve(setupInfo())
          : new Promise((resolve) => {
              resolveLate = resolve;
            }),
    },
    "~/service/api/user/auto_login": { clearAutoToken() {} },
  });
  app.render();
  app.effects[0]();
  await flush();
  const setup = app.render();
  app.effects[0]();
  setup.props.onSuccess("operator");
  resolveLate({ need_init: false });
  await flush();
  const tree = app.render();
  assert.ok(find(tree, (n) => n.type === "./completion-animation"));
  assert.equal(
    find(tree, (n) => n.type === app.exports.LoginFormView),
    null,
  );
});

for (const outcome of [false, "missing", "failed", "incomplete"]) {
  test(`GET /init ${outcome} 决定登录或重试`, async () => {
    const app = load("../app/pages/login/login.tsx", {
      "~/service/api/user/user": {
        getInitialization: async () => {
          if (outcome === "failed") throw new Error("offline");
          return outcome === "missing"
            ? {}
            : outcome === "incomplete"
              ? { need_init: true }
              : { need_init: false };
        },
      },
    });
    app.render();
    app.effects[0]();
    await flush();
    const tree = app.render();
    if (outcome === false) {
      assert.ok(find(tree, (n) => n.type === app.exports.LoginFormView));
      assert.equal(
        find(tree, (n) => n.type === "./features-modal"),
        null,
      );
      assert.equal(
        find(tree, (n) => n.type === "./completion-animation"),
        null,
      );
    } else assert.ok(find(tree, (n) => n.props?.role === "alert"));
  });
}

function formHarness(implementation, info = setupInfo()) {
  const calls = [],
    successes = [],
    conflicts = [];
  const app = load("../app/pages/login/initialize.tsx", {
    "~/service/api/user/user": {
      initialize: async (data) => {
        calls.push(data);
        return implementation(data);
      },
    },
  });
  const props = {
    info,
    onSuccess: (...args) => successes.push(args),
    onConflict: () => conflicts.push(true),
  };
  const tree = app.render(props);
  const form = find(tree, (n) => typeof n.props?.onFinish === "function");
  app.form.setFieldsValue(form.props.initialValues);
  const render = () => app.render(props);
  return {
    app,
    calls,
    successes,
    conflicts,
    render,
    async next() {
      const button = find(render(), (n) => n.props?.children === "下一步");
      assert.ok(button);
      let prevented = false;
      button.props.onClick({
        preventDefault() {
          prevented = true;
        },
      });
      assert.equal(
        prevented,
        true,
        "next-step click must cancel native form submission",
      );
      await flush();
    },
    async back() {
      const button = find(render(), (n) => n.props?.children === "上一步");
      assert.ok(button);
      button.props.onClick();
      await flush();
    },
    async account() {
      await this.next();
      await this.next();
      await this.next();
    },
    async submit(values) {
      app.form.setFieldsValue(values);
      return find(
        render(),
        (n) => typeof n.props?.onFinish === "function",
      ).props.onFinish({ ...app.form.values });
    },
  };
}
const credentials = {
  username: "operator",
  password: "chosen",
  confirm_password: "chosen",
};

test("接入信息按单列排列，隐藏派生国标域与重启提示", () => {
  const h = formHarness(() => ({}));
  const connection = find(
    h.render(),
    (n) => n.props?.className === "init-page init-connection",
  );
  const fields = connection.props.children.filter((n) => n?.type === "Item");
  assert.deepEqual(
    Array.from(fields, (n) => n.props.label),
    [
      "SIP 服务地址",
      "国标 ID",
      "SIP 监听端口（TCP / UDP）",
      "SIP 注册密码",
      "国标收流 IP",
    ],
  );
  assert.equal(
    find(connection, (n) => n.props?.label === "国标域"),
    null,
  );
  const listener = fields[2].props.children;
  assert.equal(listener.props.value, setupInfo().sip.port);
  assert.equal(listener.props.readOnly, true);
  const note = find(connection, (n) => n.props?.className === "init-note");
  assert.doesNotMatch(text(note), /重启/);
  const loginSource = readFileSync(
    new URL("../app/pages/login/login.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(loginSource, /请重启服务|重启生效/);
  const css = readFileSync(
    new URL("../app/pages/login/initialize.css", import.meta.url),
    "utf8",
  );
  const layout = css.match(/\.init-connection, \.init-onvif \{([^}]+)\}/)?.[1];
  assert.match(layout, /grid-template-columns:\s*minmax\(0, 1fr\);/);
});

test("删除接入说明，输入宽度限制为380px并兼容窄屏", async () => {
  const h = formHarness(() => ({}));
  assert.doesNotMatch(text(h.render()), /添加设备接入信息/);
  assert.equal(
    find(h.render(), (n) => n.props?.className === "init-description"),
    null,
  );
  await h.next();
  assert.match(
    text(h.render()),
    /为 Home Assistant、NVR 等客户端设置独立的 ONVIF 访问凭据/,
  );
  await h.back();
  assert.equal(
    find(h.render(), (n) => n.props?.className === "init-description"),
    null,
  );
  const css = readFileSync(
    new URL("../app/pages/login/initialize.css", import.meta.url),
    "utf8",
  );
  const panel = css.match(/\.init-panel \{([^}]+)\}/)?.[1];
  assert.match(panel, /width:\s*min\(700px, 100%\);/);
  const field = css.match(/\.init-content \.ant-form-item \{([^}]+)\}/)?.[1];
  assert.match(field, /width:\s*min\(380px, 100%\);/);
});

test("所有初始化步骤均不显示鼓励语或保留提示占位", async () => {
  const h = formHarness(() => ({}));
  const reassurance = () =>
    find(h.render(), (n) => n.props?.className === "init-reassurance");
  assert.equal(reassurance(), null);
  await h.next();
  assert.equal(reassurance(), null);
  await h.next();
  assert.equal(reassurance(), null);
  await h.next();
  assert.equal(reassurance(), null);
});

test("SIP 密码显示免密注册提示，并说明已有密码的保留规则", () => {
  const h = formHarness(() => ({}));
  const password = find(h.render(), (n) => n.props?.name === "sip_password");
  assert.equal(password.props.children.props.placeholder, "留空支持免密注册");
  assert.match(password.props.tooltip, /默认未设置 SIP 密码时支持免密注册/);
  assert.match(
    password.props.tooltip,
    /若部署配置已有 SIP 密码，留空仍保留该密码/,
  );
});

test("国标 ID 显示长度，ID、收流 IP 和 ONVIF 密码均必填", () => {
  const h = formHarness(() => ({}));
  const field = (name) => find(h.render(), (n) => n.props?.name === name);
  for (const name of ["sip_id", "sdp_ip", "onvif_password"]) {
    assert.ok(field(name).props.rules.some((rule) => rule.required));
  }
  const id = field("sip_id");
  assert.equal(id.props.children.props.showCount, true);
  assert.equal(id.props.children.props.maxLength, 20);
  const pattern = id.props.rules.find((rule) => rule.pattern).pattern;
  assert.equal(pattern.test("34020000002000000001"), true);
  assert.equal(pattern.test("3402000000200000000"), false);
  assert.equal(field("sip_password").props.rules, undefined);
  assert.equal(
    field("sip_password").props.children.props.placeholder,
    "留空支持免密注册",
  );
  assert.equal(
    field("onvif_password").props.children.props.placeholder,
    "请输入 ONVIF 密码",
  );
  assert.equal(
    find(h.render(), (n) => n.props?.className === "init-step-tag").props
      .children,
    "必填",
  );
});

test("ONVIF 与账号步骤不再显示已删除的配置说明", async () => {
  const h = formHarness(() => ({}));
  await h.next();
  assert.doesNotMatch(
    text(h.render()),
    /用户名沿用部署配置|自定义密码保存后需重启生效/,
  );
  await h.next();
  await h.next();
  assert.doesNotMatch(text(h.render()), /设置你的登录账号|完成后统一保存/);
  assert.equal(
    find(h.render(), (n) => n.props?.className === "init-description"),
    null,
  );
});

test("端口页使用接口端口并提示按compose映射放行，不显示仅供核对", async () => {
  for (const [web, sip] of [
    [15123, 15060],
    [17123, 17060],
  ]) {
    const info = setupInfo();
    info.firewall.unshift(
      {
        id: "media_api",
        label: "媒体服务 HTTP API",
        ports: "8080",
        protocols: ["TCP"],
      },
      {
        id: "device_access",
        label: "主动连接设备",
        ports: "",
        protocols: ["TCP"],
      },
      {
        id: "web",
        label: "平台 Web / API / ONVIF SOAP",
        ports: String(web),
        protocols: ["TCP"],
      },
      {
        id: "sip",
        label: "国标 SIP 信令",
        ports: String(sip),
        protocols: ["TCP", "UDP"],
      },
    );
    const h = formHarness(() => ({}), info);
    await h.next();
    await h.next();
    const tree = h.render();
    const table = find(tree, (n) => n.type === "table");
    assert.match(text(table), new RegExp(String(web)));
    assert.match(text(table), new RegExp(String(sip)));
    assert.match(text(table), /TCP \/ UDP/);
    assert.match(text(tree), /请根据实际 docker compose 映射端口配置安全组/);
    assert.doesNotMatch(text(tree), /仅供核对/);
    assert.doesNotMatch(
      text(table),
      /媒体服务 HTTP API|8080|主动连接设备|按媒体/,
    );
  }
});
function heading(h) {
  return find(h.render(), (n) => n.type === "h2").props.children;
}

test("四步流转，账号最后填写，中间步骤不提交，返回保留所有值", async () => {
  const h = formHarness(() => ({ restart_required: true }));
  assert.equal(heading(h), "GB/T 28181");
  assert.equal(
    find(h.render(), (n) => n.props?.["aria-label"] === "初始化步骤"),
    null,
  );
  await h.submit(credentials);
  assert.equal(h.calls.length, 0);
  h.app.form.setFieldsValue({ sip_password: "sip", sdp_ip: "198.51.100.10" });
  await h.next();
  assert.equal(heading(h), "ONVIF");
  await h.submit(credentials);
  assert.equal(h.calls.length, 0);
  h.app.form.setFieldsValue({ onvif_password: "onvif" });
  await h.next();
  assert.equal(heading(h), "防火墙与安全组");
  assert.doesNotMatch(text(h.render()), /还差一点点就完成啦/);
  const table = find(h.render(), (n) => n.type === "table");
  assert.match(text(table), /31001-31100/);
  assert.match(text(table), /554/);
  assert.doesNotMatch(text(table), /按媒体|设备配置/);
  assert.ok(
    !text(table).includes("动态分配"),
    "port table should omit long descriptions",
  );
  assert.ok(
    !text(table).includes("设备 → 媒体节点"),
    "port table should focus on purpose, port and protocol",
  );
  await h.submit(credentials);
  assert.equal(h.calls.length, 0);
  await h.back();
  assert.equal(heading(h), "ONVIF");
  assert.equal(h.app.form.values.onvif_password, "onvif");
  await h.back();
  assert.equal(heading(h), "GB/T 28181");
  assert.equal(h.app.form.values.sip_password, "sip");
  await h.account();
  assert.equal(heading(h), "账号密码");
  await h.submit(credentials);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0])), {
    username: "operator",
    password: "chosen",
    sip: { host: "192.0.2.2", id: "34020000002000000001", password: "sip" },
    media: { sdp_ip: "198.51.100.10" },
    onvif_password: "onvif",
  });
  assert.deepEqual(h.successes, [["operator"]]);
  assert.deepEqual(h.app.notifications, [], "初始化成功不再弹出消息提示");
});

test("SIP 服务地址和注册密码可留空，当前步骤验证失败不前进", async () => {
  const h = formHarness(() => ({ restart_required: false }));
  h.app.form.rejectNext = true;
  await h.next();
  assert.equal(heading(h), "GB/T 28181");
  assert.equal(h.calls.length, 0);
  h.app.form.setFieldsValue({
    sip_host: "",
    sip_password: "",
    onvif_password: "synthetic-onvif",
  });
  await h.account();
  await h.submit(credentials);
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0])), {
    username: "operator",
    password: "chosen",
    sip: { id: "34020000002000000001" },
    media: { sdp_ip: "192.0.2.8" },
    onvif_password: "synthetic-onvif",
  });
});

test("确认密码不一致、空白账号或过长凭据不会发起提交", async () => {
  const h = formHarness(() => ({ restart_required: false }));
  await h.account();
  await h.submit({ ...credentials, confirm_password: "other" });
  await h.submit({ ...credentials, username: " " });
  await h.submit({
    username: "操作员".repeat(15),
    password: "密码".repeat(30),
    confirm_password: "密码".repeat(30),
  });
  assert.equal(h.calls.length, 0);
  assert.equal(h.successes.length, 0);
});

test("提交失败留在账号步骤并允许返回修改，重复初始化请求重新检查 GET 状态", async () => {
  for (const [status, msg, initialized] of [
    [500, "保存失败", false],
    [400, "收流地址无效", false],
    [400, "账号已初始化，请登录", true],
  ]) {
    const h = formHarness(() => {
      throw { response: { status, data: { msg } } };
    });
    await h.account();
    await h.submit(credentials);
    assert.equal(h.successes.length, 0);
    assert.equal(h.conflicts.length, initialized ? 1 : 0);
    if (!initialized) {
      assert.equal(heading(h), "账号密码");
      assert.equal(h.app.form.values.password, "chosen");
      assert.ok(find(h.render(), (n) => n.props?.role === "alert"));
      await h.back();
      assert.equal(heading(h), "防火墙与安全组");
    }
  }
});

test("最终提交进行中重复触发仅发送一次", async () => {
  let resolve;
  const pending = new Promise((r) => {
    resolve = r;
  });
  const h = formHarness(() => pending);
  await h.account();
  const first = h.submit(credentials);
  await h.submit(credentials);
  assert.equal(h.calls.length, 1);
  resolve({ restart_required: false });
  await first;
  assert.equal(h.successes.length, 1);
});

test("GET /init 使用独立接口，真实 RSA 仅加密账号密码", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  let posted;
  const app = load("../app/service/api/user/user.ts", {
    "../../config/http": {
      GET: async (url) =>
        url === "/init"
          ? { data: setupInfo() }
          : (assert.equal(url, "/login/key"),
            {
              data: {
                key: Buffer.from(
                  publicKey.export({ type: "spki", format: "pem" }),
                ).toString("base64"),
              },
            }),
      POST: async (url, body) => {
        assert.equal(url, "/init");
        posted = body;
        return { data: { restart_required: true } };
      },
    },
    "node-forge": require("node-forge"),
  });
  assert.equal((await app.exports.getInitialization()).need_init, true);
  await app.exports.initialize({
    username: "测试账号",
    password: "chosen-密码",
    sip: { password: "sip" },
    media: { sdp_ip: "198.51.100.9" },
    onvif_password: "onvif",
  });
  const plain = privateDecrypt(
    {
      key: privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(posted.data, "base64"),
  );
  assert.deepEqual(JSON.parse(plain.toString()), {
    username: "测试账号",
    password: "chosen-密码",
  });
  assert.equal(posted.sip.password, "sip");
  assert.equal(posted.onvif_password, "onvif");
  assert.equal(posted.media.sdp_ip, "198.51.100.9");
  assert.equal(app.changes.length, 0);
});
