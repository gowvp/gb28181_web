import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Form, Input, Spin } from "antd";
import { ChevronDown } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CapsuleRadio } from "~/components/xui/capsule_radio";
import { isDemoMode } from "~/components/settings/general_settings";
import { toastSuccess, toastWarn } from "~/components/xui/toast";
import {
  EditMediaServer,
  FindMediaServers,
  findMediaServersKey,
} from "~/service/api/media/media";
import { ErrorHandle } from "~/service/config/error";

interface AdvancedStreamOptionsProps {
  show: boolean;
  onToggle: () => void;
  t: (key: string) => string;
}

/**
 * 将收流配置的高级选项独立成子组件：
 * 保持主表单函数简洁，封装高级选择的折叠交互与网络地址字段。
 */
function AdvancedStreamOptions({
  show,
  onToggle,
  t,
}: AdvancedStreamOptionsProps) {
  return (
    <>
      <div className="pt-1 pb-2">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors select-none font-medium cursor-pointer"
        >
          <span>高级选择</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              show ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
      <div style={{ display: show ? "block" : "none" }}>
        <div className="flex items-center justify-between pb-3 mb-1 border-b border-slate-100">
          <div>
            <div className="text-xs font-semibold text-slate-800">{t("media_type")}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {t("media_type_desc")}
            </div>
          </div>
          <Form.Item
            name="type"
            initialValue="zlm"
            rules={[{ required: true, message: t("input_required") }]}
            className="!mb-0"
          >
            <CapsuleRadio
              options={[
                { label: "ZLM", value: "zlm", fontMono: true },
                { label: "Lalmax", value: "lalmax", fontMono: true },
              ]}
            />
          </Form.Item>
        </div>

        <Form.Item
          label={<span className="text-xs font-semibold text-slate-700">ZLM IP</span>}
          name="ip"
          rules={[
            { required: true, message: t("input_required") },
            { min: 2, max: 20, message: t("ip_length") },
          ]}
          tooltip={t("ip_desc")}
        >
          <Input
            placeholder={t("input_ip_placeholder")}
            className="!w-full !px-3 !py-2 !text-xs !bg-white !border-slate-200 !rounded-xl focus-within:!ring-2 focus-within:!ring-slate-900/10 focus-within:!border-slate-300 font-mono transition-all"
          />
        </Form.Item>

        <Form.Item
          label={<span className="text-xs font-semibold text-slate-700">{t("hook_ip")}</span>}
          name="hook_ip"
          rules={[
            { required: true, message: t("input_required") },
            { min: 2, max: 20, message: t("ip_length") },
          ]}
          tooltip={t("hook_ip_desc")}
        >
          <Input
            placeholder={t("input_hook_ip")}
            className="!w-full !px-3 !py-2 !text-xs !bg-white !border-slate-200 !rounded-xl focus-within:!ring-2 focus-within:!ring-slate-900/10 focus-within:!border-slate-300 font-mono transition-all"
          />
        </Form.Item>
      </div>
    </>
  );
}

/**
 * 封装收流配置的保存逻辑：
 * 集中管理演示模式校验、接口提交及成功后的缓存刷新与提示。
 */
function useStreamSettingsMutation(onSuccessCallback?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: any) => {
      if (isDemoMode()) {
        toastWarn("演示模式，请勿更改");
        throw new Error("demo");
      }
      const id = values.id || "unknown";
      return await EditMediaServer(id, values);
    },
    onSuccess: (data, variables) => {
      const delay = variables?.id === "local" ? 2000 : 370;
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: [findMediaServersKey],
        });
      }, delay);
      toastSuccess("收流配置已保存");
      onSuccessCallback?.();
    },
    onError: ErrorHandle,
  });
}

/**
 * 收流配置面板
 * 应用统一的 Apple 质感输入框、CapsuleRadio 胶囊单选及药丸按钮。
 */
export default function StreamSettings() {
  const { t } = useTranslation("common");
  const [form] = Form.useForm();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: [findMediaServersKey],
    queryFn: () => FindMediaServers(),
  });

  const mediaItem = data?.data?.items?.[0];

  useEffect(() => {
    if (mediaItem) {
      form.setFieldsValue(mediaItem);
    }
  }, [mediaItem, form]);

  const { mutateAsync: saveStreamSettings, isPending } =
    useStreamSettingsMutation();

  const handleFinish = async (values: any) => {
    await saveStreamSettings(values);
  };

  const handleFinishFailed = (errorInfo: any) => {
    const hasAdvancedError = errorInfo?.errorFields?.some((item: any) =>
      item.name?.some(
        (name: string) => name === "ip" || name === "hook_ip" || name === "type",
      ),
    );
    if (hasAdvancedError) {
      setShowAdvanced(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spin />
      </div>
    );
  }

  return (
    <div>
      <Form
        form={form}
        layout="vertical"
        className="[&_.ant-form-item]:mb-3.5 max-w-lg"
        onFinish={handleFinish}
        onFinishFailed={handleFinishFailed}
      >
        <Form.Item name="id" hidden>
          <Input />
        </Form.Item>

        <Form.Item
          label={<span className="text-xs font-semibold text-slate-700">{t("gb_receive_address")}</span>}
          name="sdp_ip"
          rules={[
            { required: true, message: t("input_required") },
            { min: 2, max: 20, message: t("address_length") },
          ]}
        >
          <Input
            placeholder={t("input_gb_address", "请输入 IP 或 域名")}
            className="!w-full !px-3 !py-2 !text-xs !bg-white !border-slate-200 !rounded-xl focus-within:!ring-2 focus-within:!ring-slate-900/10 focus-within:!border-slate-300 font-mono transition-all"
          />
        </Form.Item>

        <Form.Item
          label={<span className="text-xs font-semibold text-slate-700">{t("api_secret")}</span>}
          name="secret"
          rules={[
            { required: true, message: t("input_required") },
            { min: 2, max: 50, message: t("secret_length") },
          ]}
          tooltip={t("api_secret_desc")}
        >
          <Input.Password
            placeholder={t("input_api_secret")}
            className="!w-full !px-3 !py-2 !text-xs !bg-white !border-slate-200 !rounded-xl focus-within:!ring-2 focus-within:!ring-slate-900/10 focus-within:!border-slate-300 font-mono transition-all"
          />
        </Form.Item>

        <AdvancedStreamOptions
          show={showAdvanced}
          onToggle={() => setShowAdvanced((prev) => !prev)}
          t={t}
        />

        <div className="pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="apple-btn-capsule px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-2xs cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isPending ? "保存中..." : "保存"}
          </button>
        </div>
      </Form>
    </div>
  );
}
