import { useMutation, useQuery } from "@tanstack/react-query";
import { Form, Input, InputNumber } from "antd";
import { ChevronLeft } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router";
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
  const navigate = useNavigate();
  const [form] = Form.useForm();

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
    <div className="flex items-start justify-center min-h-[calc(100vh-80px)] pt-10">
      <div className="w-full max-w-sm rounded-2xl bg-white/55 backdrop-blur-[40px] backdrop-saturate-[180%] border border-white/50 shadow-[0_2px_20px_rgba(0,0,0,0.06),inset_0_0.5px_0_rgba(255,255,255,0.8)] p-6">
        {/* 标题行 + 返回 */}
        <div className="flex items-center gap-2 mb-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-0.5 text-[#0071e3] text-[15px] font-medium cursor-pointer bg-transparent border-none p-0 hover:opacity-70 active:opacity-50 transition-opacity"
          >
            <ChevronLeft className="w-5 h-5 -ml-1" strokeWidth={2.5} />
            <span>{t("back")}</span>
          </button>
          <span className="mx-auto" />
          <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
            {t("access_info")}
          </h3>
          <span className="mx-auto" />
          <span className="w-[60px]" />
        </div>

        <Form
          form={form}
          layout="vertical"
          className="[&_.ant-form-item]:mb-3 [&_.ant-input]:rounded-lg [&_.ant-input-password]:rounded-lg [&_.ant-input-number]:rounded-lg [&_.ant-input-affix-wrapper]:rounded-lg"
        >
          <Form.Item
            label={t("server_ip")}
            name="host"
            tooltip={t("server_ip_tip")}
          >
            <Input placeholder={t("input_server_ip")} />
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

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full h-9 mt-3 rounded-full bg-[#1d1d1f] text-white text-[14px] font-medium cursor-pointer border-none transition-all duration-200 hover:bg-[#424245] active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
          >
            {isPending ? "..." : t("save_config")}
          </button>
        </Form>
      </div>
    </div>
  );
}
