import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Form, Input, Radio, Spin } from "antd";
import { ChevronDown } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
 * 为什么将收流配置的高级选项独立成子组件：
 * 保持主表单函数简洁在40行内，同时封装高级选择的折叠交互与网络地址字段。
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
        <Form.Item
          label="ZLM IP"
          name="ip"
          rules={[
            { required: true, message: t("input_required") },
            { min: 2, max: 20, message: t("ip_length") },
          ]}
          tooltip={t("ip_desc")}
        >
          <Input placeholder={t("input_ip_placeholder")} />
        </Form.Item>

        <Form.Item
          label={t("hook_ip")}
          name="hook_ip"
          rules={[
            { required: true, message: t("input_required") },
            { min: 2, max: 20, message: t("ip_length") },
          ]}
          tooltip={t("hook_ip_desc")}
        >
          <Input placeholder={t("input_hook_ip")} />
        </Form.Item>
      </div>
    </>
  );
}

/**
 * 为什么封装收流配置的保存逻辑：
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
 * 为什么在设置中提供收流配置面板：
 * 将原本分散在流媒体节点的配置统一收敛至全局设置中，方便集中运维与参数修改。
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
      item.name?.some((name: string) => name === "ip" || name === "hook_ip"),
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
      <h3 className="text-base font-medium mb-1">收流配置</h3>
      <p className="text-xs text-gray-500 mb-4">
        配置流媒体服务接入参数，管理国标收流与回调用网络地址
      </p>

      <Form
        form={form}
        layout="vertical"
        className="[&_.ant-form-item]:mb-3 max-w-lg"
        onFinish={handleFinish}
        onFinishFailed={handleFinishFailed}
      >
        <Form.Item name="id" hidden>
          <Input />
        </Form.Item>

        <div className="flex items-center justify-between py-3 mb-2">
          <div>
            <div className="text-sm font-medium text-gray-900">{t("media_type")}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {t("media_type_desc")}
            </div>
          </div>
          <Form.Item
            name="type"
            initialValue="zlm"
            rules={[{ required: true, message: t("input_required") }]}
            className="!mb-0"
          >
            <Radio.Group
              size="small"
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="zlm" className="min-w-[72px] text-center">ZLM</Radio.Button>
              <Radio.Button value="lalmax" className="min-w-[72px] text-center">Lalmax</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </div>

        <Form.Item
          label={t("api_secret")}
          name="secret"
          rules={[
            { required: true, message: t("input_required") },
            { min: 2, max: 50, message: t("secret_length") },
          ]}
          tooltip={t("api_secret_desc")}
        >
          <Input placeholder={t("input_api_secret")} />
        </Form.Item>

        <Form.Item
          label={t("gb_receive_address")}
          name="sdp_ip"
          rules={[
            { required: true, message: t("input_required") },
            { min: 2, max: 20, message: t("address_length") },
          ]}
        >
          <Input placeholder={t("input_gb_address", "请输入 IP 或 域名")} />
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
            className="px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 rounded-lg transition-colors cursor-pointer"
          >
            {isPending ? "保存中..." : "保存"}
          </button>
        </div>
      </Form>
    </div>
  );
}
