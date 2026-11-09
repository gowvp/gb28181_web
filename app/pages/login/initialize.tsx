import { Form, Input, message } from "antd";
import { useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { type InitializationSetup, initialize } from "~/service/api/user/user";
import "./initialize.css";

type Fields = {
  username: string;
  password: string;
  confirm_password: string;
  sip_host?: string;
  sip_id?: string;
  sip_password?: string;
  sdp_ip?: string;
  onvif_password?: string;
};
const STEPS = ["GB/T 28181", "ONVIF", "防火墙与安全组", "账号密码"];
const STEP_FIELDS: (keyof Fields)[][] = [
  ["sip_host", "sip_id", "sip_password", "sdp_ip"],
  ["onvif_password"],
  [],
];

export default function InitializeView({
  info,
  onSuccess,
  onConflict,
}: {
  info: InitializationSetup;
  onSuccess: (username: string) => void;
  onConflict: () => void;
}) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [form] = Form.useForm<Fields>();
  const next = async () => {
    if (loading || step >= 3) return;
    try {
      await form.validateFields(STEP_FIELDS[step]);
      setError("");
      contentRef.current?.scrollTo({ top: 0 });
      setStep(step + 1);
    } catch {
      /* Keep field validation next to the current input. */
    }
  };
  const back = () => {
    if (loading || step === 0) return;
    setError("");
    contentRef.current?.scrollTo({ top: 0 });
    setStep(step - 1);
  };
  const submit = async (values: Fields) => {
    // A form submit or Enter key from an earlier step must never initialize.
    if (step !== 3 || submitting.current) return;
    if (!values.username.trim() || !values.password.trim()) {
      setError("请输入账号和密码");
      return;
    }
    if (values.password !== values.confirm_password) {
      setError("两次输入的密码不一致");
      return;
    }
    const credentialBytes = new TextEncoder().encode(
      JSON.stringify({
        username: values.username.trim(),
        password: values.password,
        auto_login: false,
      }),
    ).length;
    if (credentialBytes > 190) {
      setError("账号和密码内容过长，请缩短后重试");
      return;
    }
    submitting.current = true;
    setLoading(true);
    setError("");
    try {
      const sip = {
        ...(values.sip_host?.trim() ? { host: values.sip_host.trim() } : {}),
        ...(values.sip_id?.trim() ? { id: values.sip_id.trim() } : {}),
        ...(values.sip_password ? { password: values.sip_password } : {}),
      };
      await initialize({
        username: values.username.trim(),
        password: values.password,
        ...(Object.keys(sip).length ? { sip } : {}),
        ...(values.sdp_ip?.trim()
          ? { media: { sdp_ip: values.sdp_ip.trim() } }
          : {}),
        ...(values.onvif_password
          ? { onvif_password: values.onvif_password }
          : {}),
      });
      form.resetFields();
      onSuccess(values.username.trim());
    } catch (err) {
      const response = (
        err as { response?: { status?: number; data?: { msg?: string } } }
      ).response;
      if (
        response?.status === 400 &&
        response.data?.msg === "账号已初始化，请登录"
      ) {
        message.info("账号已初始化，请登录");
        onConflict();
      } else {
        setError(response?.data?.msg || "初始化失败，请检查连接后重试");
      }
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="init-shell">
      <div className="init-panel" data-testid="init-panel">
        <header className="init-header">
          <div className="init-heading-row">
            <div className="init-title">
              <h2>{STEPS[step]}</h2>
              {step !== 2 && <span className="init-step-tag">必填</span>}
            </div>
            <div className="init-brand">
              <span className="init-brand-mark" aria-hidden="true">
                ◈
              </span>
              <span>平台初始设置</span>
            </div>
          </div>
          {(step === 1 || step === 2) && (
            <p className="init-description">
              {step === 1
                ? "为 Home Assistant、NVR 等客户端设置独立的 ONVIF 访问凭据。"
                : "查看各端口的用途，按需要放行即可。"}
            </p>
          )}
        </header>
        <Form
          form={form}
          className="init-form"
          layout="vertical"
          onFinish={submit}
          disabled={loading}
          initialValues={{
            sip_host: info.sip.host,
            sip_id: info.sip.id,
            sdp_ip: info.media.sdp_ip,
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && step < 3) {
              event.preventDefault();
              void next();
            }
          }}
        >
          <div
            className="init-content"
            ref={contentRef}
            data-testid="init-content"
            role="region"
            aria-label="步骤内容"
            tabIndex={0}
          >
            {error && (
              <p role="alert" className="init-error">
                {error}
              </p>
            )}
            <section
              hidden={step !== 0}
              aria-label="GB/T 28181"
              className="init-page init-connection"
            >
              <Form.Item name="sip_host" label="SIP 服务地址">
                <Input
                  placeholder="设备可达的 IP 或主机名，留空自动探测"
                  maxLength={253}
                />
              </Form.Item>
              <Form.Item
                name="sip_id"
                label="国标 ID"
                rules={[
                  { required: true, message: "请输入国标 ID" },
                  { pattern: /^\d{20}$/, message: "请输入 20 位数字国标 ID" },
                ]}
              >
                <Input placeholder="20 位数字" maxLength={20} showCount />
              </Form.Item>
              <Form.Item label="SIP 监听端口（TCP / UDP）">
                <Input value={info.sip.port} readOnly />
              </Form.Item>
              <Form.Item
                name="sip_password"
                label="SIP 注册密码"
                tooltip="默认未设置 SIP 密码时支持免密注册；若部署配置已有 SIP 密码，留空仍保留该密码。设备单独设置的注册密码仍然生效。"
              >
                <Input.Password
                  autoComplete="new-password"
                  maxLength={128}
                  placeholder="留空支持免密注册"
                />
              </Form.Item>
              <Form.Item
                name="sdp_ip"
                label="国标收流 IP"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "请输入国标收流 IP",
                  },
                ]}
                tooltip="设备将向此地址推送媒体流；与 SIP 信令地址及媒体管理 API 地址独立。"
              >
                <Input placeholder="设备可达的 IPv4 或域名" maxLength={253} />
              </Form.Item>
              <p className="init-note">
                收流 IP
                应能被设备访问；部署在云端或容器中时，需同时核对公网地址和端口映射。
              </p>
            </section>
            <section
              hidden={step !== 1}
              aria-label="ONVIF"
              className="init-page init-onvif"
            >
              <Form.Item label="ONVIF 用户名">
                <Input value={info.onvif.username} readOnly />
              </Form.Item>
              <Form.Item
                name="onvif_password"
                label="ONVIF 密码"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "请输入 ONVIF 密码",
                  },
                ]}
              >
                <Input.Password
                  autoComplete="new-password"
                  maxLength={128}
                  placeholder="请输入 ONVIF 密码"
                />
              </Form.Item>
              <p className="init-note">
                用于 Home Assistant、NVR 等客户端访问本机 ONVIF
                服务，不是摄像头登录密码。
              </p>
            </section>
            <section
              hidden={step !== 2}
              aria-label="防火墙与安全组"
              className="init-page"
            >
              <p className="init-port-hint">
                请根据实际 docker compose 映射端口配置安全组
              </p>
              <div className="init-table-wrap">
                <table className="init-ports">
                  <caption className="sr-only">
                    初始化端口计划，需按部署核对
                  </caption>
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="p-3">用途</th>
                      <th className="p-3">端口</th>
                      <th className="p-3">协议</th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.firewall
                      .filter((rule) => rule.id !== "media_api" && rule.ports)
                      .map((rule) => (
                        <tr
                          key={rule.id}
                          className="border-t border-gray-100 align-top"
                        >
                          <td className="max-w-md p-3">
                            <p className="font-medium text-gray-900">
                              {rule.label}
                            </p>
                          </td>
                          <td className="whitespace-nowrap p-3">
                            <p className="font-mono text-gray-900">
                              {rule.ports}
                            </p>
                          </td>
                          <td className="p-3 text-gray-600">
                            {rule.protocols.join(" / ")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section
              hidden={step !== 3}
              aria-label="账号密码"
              className="init-page init-account"
            >
              <Form.Item
                name="username"
                label="账号"
                rules={[
                  { required: true, whitespace: true, message: "请输入账号" },
                ]}
              >
                <Input
                  autoComplete="username"
                  maxLength={32}
                  placeholder="请输入账号"
                />
              </Form.Item>
              <Form.Item
                name="password"
                label="密码"
                rules={[
                  { required: true, whitespace: true, message: "请输入密码" },
                ]}
              >
                <Input.Password
                  autoComplete="new-password"
                  maxLength={64}
                  placeholder="请设置密码"
                />
              </Form.Item>
              <Form.Item
                name="confirm_password"
                label="确认密码"
                dependencies={["password"]}
                rules={[
                  { required: true, message: "请再次输入密码" },
                  {
                    validator: (_, value) =>
                      !value || form.getFieldValue("password") === value
                        ? Promise.resolve()
                        : Promise.reject(new Error("两次输入的密码不一致")),
                  },
                ]}
              >
                <Input.Password
                  autoComplete="new-password"
                  placeholder="请再次输入密码"
                />
              </Form.Item>
            </section>
          </div>
          <footer className="init-footer" data-testid="init-footer">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="init-secondary"
                onClick={back}
                disabled={loading}
              >
                上一步
              </Button>
            ) : (
              <span className="init-back-placeholder" />
            )}
            {step < 3 ? (
              <Button
                key="next-step"
                className="init-primary"
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  void next();
                }}
              >
                下一步
              </Button>
            ) : (
              <Button
                key="finish-init"
                className="init-primary"
                type="submit"
                disabled={loading}
              >
                {loading ? "正在初始化…" : "完成初始化"}
              </Button>
            )}
          </footer>
        </Form>
      </div>
    </div>
  );
}
