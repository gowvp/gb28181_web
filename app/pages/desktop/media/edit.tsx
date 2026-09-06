import { Form, Input, Radio } from "antd";
import { ChevronDown } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { isDemoMode } from "~/components/settings/general_settings";
import { EditSheet, type PFormProps } from "~/components/xui/edit-sheet";
import { toastWarn } from "~/components/xui/toast";
import { EditMediaServer } from "~/service/api/media/media";

/**
 * 为什么抽离流媒体突变操作：
 * 避免表单组件过长，集中封装演示模式拦截与接口请求逻辑。
 */
function createMediaMutation() {
  return {
    add: async (data: any) => {
      if (isDemoMode()) {
        toastWarn("演示模式，请勿更改");
        throw new Error("demo");
      }
      const id = data.id || "unknown";
      return await EditMediaServer(id, data);
    },
    edit: async (id: string, data: any) => {
      if (isDemoMode()) {
        toastWarn("演示模式，请勿更改");
        throw new Error("demo");
      }
      return await EditMediaServer(id, data);
    },
  };
}

interface AdvancedOptionsProps {
  show: boolean;
  onToggle: () => void;
  t: (key: string) => string;
}

/**
 * 为什么将高级选项独立成组件：
 * 保持主表单函数简洁在40行内，同时封装高级选择的展开折叠与字段布局。
 */
function AdvancedOptions({ show, onToggle, t }: AdvancedOptionsProps) {
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
 * 为什么统一通过抽屉表单处理流媒体新增与编辑：
 * 改为单页配置提升填写体验，优先展示 API 秘钥与国标收流默认地址，次要网络地址收拢至高级选择。
 */
export function EditForm({ onAddSuccess, onEditSuccess, ref }: PFormProps) {
  const { t } = useTranslation("common");
  const [form] = Form.useForm();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const mutation = useMemo(() => createMediaMutation(), []);

  const handleFinishFailed = (errorInfo: any) => {
    const hasError = errorInfo?.errorFields?.some((item: any) =>
      item.name?.some((name: string) => name === "ip" || name === "hook_ip"),
    );
    if (hasError) {
      setShowAdvanced(true);
    }
  };

  return (
    <EditSheet
      form={form}
      ref={ref}
      title={t("media_config")}
      description={t("media_config_desc")}
      singlePage={true}
      onFinishFailed={handleFinishFailed}
      onSuccess={{ add: onAddSuccess, edit: onEditSuccess }}
      mutation={mutation}
      trigger={null}
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

      <AdvancedOptions
        show={showAdvanced}
        onToggle={() => setShowAdvanced((prev) => !prev)}
        t={t}
      />
    </EditSheet>
  );
}
