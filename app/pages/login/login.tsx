import type { FormProps } from "antd";
import { Checkbox, Form, Input, message } from "antd";
import { AlertTriangle, Check, Eye, EyeOff, Lock, User } from "lucide-react";
import React, { useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  COVER_BLUR_KEY,
  COVER_BLUR_STORAGE_KEY,
  getLoginPageConfig,
  LOGIN_PAGE_KEY,
  LOGIN_PAGE_STORAGE_KEY,
  type LoginPageConfig,
  syncDocumentTitle,
} from "~/components/settings/general_settings";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import logger from "~/lib/logger";
import { GetMetadata } from "~/service/api/metadata/metadata";
import {
  clearAutoToken,
  loadAutoToken,
  loadRememberedUser,
  saveAutoToken,
  saveRememberedUser,
} from "~/service/api/user/auto_login";
import { login } from "~/service/api/user/user";
import { TokenStr } from "~/service/config/http";
import { startWs } from "~/service/ws";

type FieldType = {
  username?: string;
  password?: string;
};

// 自动登录阶段文案，与 autoPhase 状态一一对应
const AUTO_PHASES = ["检测登录环境", "验证账号有效性", "进入工作台"];

function ForgotPasswordDialog() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-5 text-xs text-blue-600 hover:text-blue-700 transition-colors"
      >
        忘记密码？
      </button>
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        style={{ display: open ? "flex" : "none" }}
      >
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/20">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">忘记密码</h3>
          <p className="text-sm text-gray-600 mb-4">
            请在部署目录找到配置文件
            <br />
            检查 password 参数的值
          </p>
          <Button
            onClick={() => setOpen(false)}
            className="w-full bg-[#1d1d1f] hover:bg-[#333] text-white rounded-lg"
          >
            确定
          </Button>
        </div>
      </div>
    </>
  );
}

export default function LoginView() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [pageConfig, setPageConfig] =
    useState<LoginPageConfig>(getLoginPageConfig);
  // 短期自动登录默认不勾选，且不持久化勾选状态：每次想续期都需主动勾选
  const [autoLoginChecked, setAutoLoginChecked] = useState(false);
  const [autoLogging, setAutoLogging] = useState(false);
  // 自动登录阶段：0 检测登录环境 / 1 验证账号有效性 / 2 进入工作台
  const [autoPhase, setAutoPhase] = useState(0);
  // 防止 StrictMode 双调用与手动/自动登录并发
  const autoLoginStarted = useRef(false);
  const autoLoginAbort = useRef<AbortController | null>(null);

  React.useEffect(() => {
    GetMetadata(LOGIN_PAGE_KEY)
      .then((res) => {
        if (!res.data?.ext) return;
        try {
          const remote: LoginPageConfig = JSON.parse(res.data.ext);
          const cached = JSON.stringify(pageConfig);
          if (JSON.stringify(remote) !== cached) {
            setPageConfig(remote);
            localStorage.setItem(LOGIN_PAGE_STORAGE_KEY, res.data.ext);
          }
          if (remote.subtitle) {
            syncDocumentTitle(remote.subtitle);
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* 网络不通时静默使用 localStorage 缓存 */
      });
  }, []);

  // 登录成功后的公共收尾：同步服务端 metadata、启动 ws、跳转桌面
  const afterLoginSuccess = async () => {
    try {
      const meta = await GetMetadata(COVER_BLUR_KEY);
      localStorage.setItem(COVER_BLUR_STORAGE_KEY, meta.data?.ext ?? "false");
    } catch {
      // cover_blur metadata not found, skip sync
    }

    // 同步引导完成标记：服务端有记录则跳过引导，否则清除本地旧标记以重新触发
    try {
      const tourMeta = await GetMetadata("app_tour_completed");
      if (tourMeta.data?.ext === "true") {
        localStorage.setItem("app_tour_completed", "true");
      } else {
        localStorage.removeItem("app_tour_completed");
      }
    } catch {
      localStorage.removeItem("app_tour_completed");
    }

    startWs();
    navigate("/desktop");
  };

  // 短期自动登录：解密本地 token，用鉴权接口探活，成功直接进桌面
  // biome-ignore lint/correctness/useExhaustiveDependencies: 仅在挂载时执行一次，afterLoginSuccess 与 form 均为稳定引用
  React.useEffect(() => {
    if (autoLoginStarted.current) return;
    autoLoginStarted.current = true;

    const username = loadRememberedUser();
    if (username) {
      form.setFieldsValue({ username });
    }
    if (!username) return;

    const abort = new AbortController();
    autoLoginAbort.current = abort;

    (async () => {
      // 每阶段独立计时：业务先完成则等够最小展示时间，业务慢则阶段跟随业务，
      // 保证阶段文字可读、动画步骤与真实处理进度一致
      const PHASE_MIN_MS = 900;
      const phaseStart = Date.now();
      const waitPhaseMin = () => {
        const rest = PHASE_MIN_MS - (Date.now() - phaseStart);
        return rest > 0 ? new Promise((r) => setTimeout(r, rest)) : null;
      };

      // 阶段一：检测登录环境（读取并解密本地凭据）
      setAutoLogging(true);
      setAutoPhase(0);
      const token = await loadAutoToken(username);
      // 取消按钮与手动登录通过 abort 信号中断，此处只查信号不查闭包标志，
      // 避免 StrictMode 挂载→清理→再挂载流程把进行中的自动登录误杀
      if (!token || abort.signal.aborted) {
        if (!abort.signal.aborted) setAutoLogging(false);
        return;
      }
      await waitPhaseMin();
      if (abort.signal.aborted) return;

      // 阶段二：验证账号有效性（探针请求鉴权接口）
      setAutoPhase(1);
      const verifyStart = Date.now();
      try {
        const baseURL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
          /\/+$/,
          "",
        );
        const resp = await fetch(`${baseURL}/configs/info`, {
          headers: { authorization: `Bearer ${token}` },
          signal: abort.signal,
        });
        // 探针快返回时补足阶段二最小展示时间
        const rest = PHASE_MIN_MS - (Date.now() - verifyStart);
        if (rest > 0) await new Promise((r) => setTimeout(r, rest));
        if (abort.signal.aborted) return;

        if (resp.ok) {
          // 阶段三：验证通过，进入工作台
          setAutoPhase(2);
          localStorage.setItem(TokenStr, token);
          localStorage.setItem("user", username);
          // 给用户看清"验证通过"的收尾帧再跳转
          await new Promise((r) => setTimeout(r, 600));
          if (abort.signal.aborted) return;
          message.success("登录成功！");
          await afterLoginSuccess();
          return;
        }
        if (resp.status === 401 || resp.status === 403) {
          // 凭据已失效：清除自动登录凭据，留在登录页（用户名已填充）
          clearAutoToken();
          return;
        }
        // 其他状态码（5xx 等）视为服务异常，保留凭据待下次尝试
      } catch {
        // 网络不通或主动取消：保留凭据，静默回到登录页
      } finally {
        if (!abort.signal.aborted) setAutoLogging(false);
      }
    })();

    // 注意：不在 cleanup 中 abort。StrictMode 下 cleanup 会在二次挂载前触发，
    // 若在此中断，autoLoginStarted 已置位，自动登录将永远不会执行
  }, []);

  const cancelAutoLogin = () => {
    autoLoginAbort.current?.abort();
    autoLoginAbort.current = null;
    setAutoLogging(false);
  };

  const onFinish: FormProps<FieldType>["onFinish"] = async (values) => {
    if (!values.username || !values.password) {
      setLoginError("请输入用户名和密码");
      return;
    }

    // 手动登录优先：取消进行中的自动登录
    cancelAutoLogin();

    setLoading(true);
    setLoginError(null);
    try {
      const result = await login({
        username: values.username,
        password: values.password,
        autoLogin: autoLoginChecked,
      });

      saveRememberedUser(values.username);
      if (autoLoginChecked) {
        await saveAutoToken(values.username, result.token);
      } else {
        clearAutoToken();
      }

      await afterLoginSuccess();
      message.success("登录成功！");
    } catch (error) {
      logger.error("login failed:", error);
      setLoginError(
        error instanceof Error ? error.message : "登录失败，请重试",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-100 flex items-center justify-center p-4">
      {/* 背景装饰元素 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-blue-100/40 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-gray-200/30 rounded-full blur-2xl"></div>
      </div>

      {/* 自动登录遮罩：分阶段展示验证进度，可随时取消回到手动登录 */}
      {autoLogging && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-50/95 via-blue-50/60 to-gray-100/95 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-7 px-12 py-9 rounded-3xl bg-white/70 backdrop-blur-xl shadow-2xl border border-white/40">
            {/* 阶段图标：进行中为旋转环，完成为打勾 */}
            <div className="relative w-14 h-14">
              {autoPhase < 2 ? (
                <>
                  <div className="absolute inset-0 rounded-full border-[3px] border-slate-200 border-t-slate-500 animate-spin motion-reduce:animate-none" />
                  <User className="absolute inset-0 m-auto w-5 h-5 text-slate-500" />
                </>
              ) : (
                <div className="absolute inset-0 rounded-full bg-emerald-500 flex items-center justify-center animate-in zoom-in-50 duration-300">
                  <Check className="w-7 h-7 text-white" strokeWidth={3} />
                </div>
              )}
            </div>

            {/* 阶段文字：交叉淡化切换，固定高度避免布局跳动 */}
            <div className="relative h-6 w-56 text-center">
              {AUTO_PHASES.map((phase, i) => (
                <p
                  key={phase}
                  className={`absolute inset-0 text-[15px] font-medium tracking-wide transition-opacity duration-300 ${
                    i === autoPhase
                      ? "opacity-100 text-gray-800"
                      : "opacity-0 text-gray-400"
                  }`}
                >
                  {phase}
                </p>
              ))}
            </div>

            {/* 进度条：随阶段连续推进，临界阻尼式缓动 */}
            <div className="w-56 h-1 rounded-full bg-slate-200/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-700 transition-all duration-700 ease-out motion-reduce:transition-none"
                style={{
                  width: `${((autoPhase + 1) / AUTO_PHASES.length) * 100}%`,
                }}
              />
            </div>

            <button
              type="button"
              onClick={cancelAutoLogin}
              className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
            >
              取消并手动登录
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 w-full max-w-sm">
        <Card className="shadow-2xl bg-white/80 backdrop-blur-xl border-0 rounded-3xl overflow-hidden">
          {/* Logo 和标题区域 */}
          <div className="px-8 pt-10 pb-8 text-center">
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              {pageConfig.title || "欢迎回来"}
            </h1>
            <p className="text-gray-500 text-sm">
              {pageConfig.subtitle || "开箱即用的监控平台"}
            </p>
          </div>

          <CardContent className="px-8 pb-10 pt-0">
            {loginError && (
              <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}
            <Form
              form={form}
              name="login"
              onFinish={onFinish}
              autoComplete="new-password"
              className="space-y-6"
            >
              <Form.Item<FieldType>
                name="username"
                rules={[{ required: true, message: "请输入用户名" }]}
                className="mb-6"
              >
                <Input
                  prefix={<User className="h-4 w-4 text-gray-400" />}
                  placeholder="admin"
                  size="large"
                  autoComplete="nope"
                  className="h-12 rounded-xl border-gray-200 hover:border-blue-400 focus:border-blue-500"
                />
              </Form.Item>

              <Form.Item<FieldType>
                name="password"
                rules={[{ required: true, message: "请输入密码" }]}
                className="mb-8"
              >
                <Input.Password
                  prefix={<Lock className="h-4 w-4 text-gray-400" />}
                  placeholder="admin"
                  size="large"
                  autoComplete="new-password"
                  className="h-12 rounded-xl border-gray-200 hover:border-blue-400 focus:border-blue-500"
                  iconRender={(visible) =>
                    visible ? (
                      <Eye
                        style={{ width: 18, height: 18, color: "#d1d5db" }}
                        className="cursor-pointer"
                      />
                    ) : (
                      <EyeOff
                        style={{ width: 18, height: 18, color: "#d1d5db" }}
                        className="cursor-pointer"
                      />
                    )
                  }
                />
              </Form.Item>

              <Form.Item className="mb-4">
                <Checkbox
                  checked={autoLoginChecked}
                  onChange={(e) => setAutoLoginChecked(e.target.checked)}
                  className="text-sm text-gray-600"
                >
                  短期自动登录
                </Checkbox>
              </Form.Item>

              <Form.Item className="mb-4 flex justify-center">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-72 min-h-11 bg-slate-900 hover:bg-black disabled:bg-slate-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl disabled:shadow-none transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 border-0"
                >
                  {loading ? "登录中..." : "登 录"}
                </Button>
              </Form.Item>
            </Form>

            <div className="text-center">
              <ForgotPasswordDialog />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
