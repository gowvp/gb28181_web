import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Form, Input, message } from "antd";
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from "@ant-design/icons";
import type { FormProps } from "antd";
import { login } from "~/service/api/user/user";
import { ErrorHandle } from "~/service/config/error";


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
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ display: open ? 'flex' : 'none' }}>
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/20">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">忘记密码</h3>
          <p className="text-sm text-gray-600 mb-4">请在部署目录找到配置文件<br />检查 password 参数的值</p>
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

  const onFinish: FormProps<FieldType>["onFinish"] = async (values) => {
    if (!values.username || !values.password) {
      message.error("请输入用户名和密码");
      return;
    }

    setLoading(true);
    try {
      await login({
        username: values.username,
        password: values.password,
      });

      message.success("登录成功！");
      navigate("/desktop");
    } catch (error) {
      ErrorHandle(error);
      console.log("🚀 ~ onFinish ~ error:", error)
      message.error(error instanceof Error ? error.message : "登录失败，请重试");
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
            {/* <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div> */}
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">欢迎回来</h1>
            <p className="text-gray-500 text-sm">开箱即用的监控平台</p>
          </div>

          <CardContent className="px-8 pb-10 pt-0">
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
                  className="h-12 rounded-xl border-gray-200 hover:border-blue-400 focus:border-blue-500"
                  iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                />
              </Form.Item>

              <Form.Item className="mb-4 flex justify-center">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-72 h-10 bg-gradient-to-r from-black via-zinc-800 to-zinc-900 hover:from-zinc-900 hover:to-black disabled:from-zinc-700 disabled:to-zinc-800 text-white font-medium rounded-xl shadow-lg hover:shadow-xl disabled:shadow-none transition-all duration-200 transform hover:scale-[1.02] disabled:scale-100 border-0"
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

        {/* 底部信息 */}
        {/* <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">© 2024 监控平台 保留所有权利</p>
        </div> */}
      </div>
    </div>
  );
}
