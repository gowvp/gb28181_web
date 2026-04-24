import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Form, Input, InputNumber } from "antd";
import React from "react";
import { useTranslation } from "react-i18next";
import { toastSuccess } from "~/components/xui/toast";
import {
  GetConfigInfo,
  getConfigInfoKey,
  SetConfigSIP,
} from "~/service/api/config/config";
import { ErrorHandle } from "~/service/config/error";

// 从国标 ID 派生域 (前 10 位), 与后端 SIP.GetDomain() 一致
function deriveDomain(id?: string): string {
  if (!id) return "";
  return id.length >= 10 ? id.slice(0, 10) : id;
}

export default function config() {
  const { t } = useTranslation("common");
  const [form] = Form.useForm();
  const [serverIp, setServerIp] = React.useState<string>("");

  // 从网页地址栏提取IP
  React.useEffect(() => {
    const hostname = window.location.hostname;

    // 如果是IP地址，直接使用
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
      setServerIp(hostname);
    } else if (hostname === "localhost" || hostname === "127.0.0.1") {
      // 本地开发环境
      setServerIp(hostname);
    } else {
      // 如果是域名，尝试通过DNS查询转换为IP（浏览器限制，只能显示域名）
      setServerIp(hostname);
    }
  }, []);

  const { data } = useQuery({
    queryKey: [getConfigInfoKey],
    queryFn: () => GetConfigInfo(),
  });

  React.useEffect(() => {
    if (data?.data.sip) {
      const sip = data.data.sip;
      form.setFieldsValue({
        ...sip,
        domain: deriveDomain(sip.id),
      });
    }
  }, [data, form]);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (values: any) => SetConfigSIP(values),
    onError: ErrorHandle,
    onSuccess: () => {
      toastSuccess(t("save_success"));
    },
  });

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const { domain: _omitDomain, ...payload } = values;
      await mutateAsync(payload);
    } catch (error) {
      console.log("表单验证失败:", error);
    }
  };

  // 为什么: 域由 ID 前 10 位派生, 输入 ID 时同步显示, 避免用户手工保持两者一致。
  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setFieldValue("domain", deriveDomain(e.target.value));
  };

  return (
    <div className="w-[380px] px-6 pt-6 m-auto">
      <Form form={form} layout="vertical" size="large">
        <Form.Item label={t("server_ip")}>
          <Input value={serverIp} disabled />
        </Form.Item>

        <Form.Item
          label={t("gb_id")}
          name="id"
          rules={[
            { required: true, message: t("input_required") },
            { min: 18, max: 20, message: t("gb_id_length") },
          ]}
        >
          <Input
            placeholder={t("input_gb_id")}
            onChange={handleIdChange}
            suffix={
              <span className="text-xs text-gray-400">
                {(form.getFieldValue("id") || "").length}
              </span>
            }
          />
        </Form.Item>

        <Form.Item label={t("gb_domain")} name="domain">
          <Input disabled placeholder={t("input_gb_domain")} />
        </Form.Item>

        <Form.Item
          label={t("port_udp_tcp")}
          name="port"
          rules={[
            { required: true, message: t("input_required") },
            { type: "number", min: 1, max: 65535, message: t("port_range") },
          ]}
          tooltip={t("port_config_tip")}
        >
          <InputNumber
            disabled
            style={{ width: "100%" }}
            placeholder={t("input_port")}
          />
        </Form.Item>

        <Form.Item label={t("password")} name="password">
          <Input.Password placeholder={t("input_password_placeholder")} />
        </Form.Item>

        <Button
          type="primary"
          loading={isPending}
          onClick={handleSubmit}
          block
          size="large"
          className="mt-6"
        >
          {t("save_config")}
        </Button>
      </Form>
    </div>
  );
}
