import {
  EyeInvisibleOutlined,
  EyeTwoTone,
  LockOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router";
import type { FormProps } from "antd";
import { Form, Input, message } from "antd";
import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  COVER_BLUR_KEY,
  COVER_BLUR_STORAGE_KEY,
  LOGIN_PAGE_KEY,
  LOGIN_PAGE_STORAGE_KEY,
  type LoginPageConfig,
  getLoginPageConfig,
  syncDocumentTitle,
} from "~/components/settings/general_settings";
import { GetMetadata } from "~/service/api/metadata/metadata";
import { login } from "~/service/api/user/user";
import { startWs } from "~/service/ws";
import logger from "~/lib/logger";

type FieldType = {
  username?: string;
  password?: string;
};

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
            className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
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

  const [pageConfig, setPageConfig] = useState<LoginPageConfig>(getLoginPageConfig);

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
        } catch { /* ignore */ }
      })
      .catch(() => { /* 网络不通时静默使用 localStorage 缓存 */ });
  }, []);

  const onFinish: FormProps<FieldType>["onFinish"] = async (values) => {
    if (!values.username || !values.password) {
      setLoginError("请输入用户名和密码");
      return;
    }

    setLoading(true);
    setLoginError(null);
    try {
      await login({
        username: values.username,
        password: values.password,
      });

      // 登录后同步服务端 metadata 到 localStorage
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
      message.success("登录成功！");
      navigate("/desktop");
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
                  prefix={<UserOutlined className="text-gray-400" />}
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
                  prefix={<LockOutlined className="text-gray-400" />}
                  placeholder="admin"
                  size="large"
                  autoComplete="new-password"
                  iconRender={(visible) =>
                    visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                  }
                  className="h-12 rounded-xl border-gray-200 hover:border-blue-400 focus:border-blue-500"
                />
              </Form.Item>

              <Form.Item className="mb-0">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
                >
                  {loading ? "登录中..." : "登录"}
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
