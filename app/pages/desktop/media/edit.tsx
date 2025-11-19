import React from "react";
import { AddRTMP } from "~/service/api/rtmp/rtmp";
import { EditSheet, type PFormProps } from "~/components/xui/edit-sheet";
import { Form, Input } from "antd";
import { EditMediaServer } from "~/service/api/media/media";
import { useTranslation } from "react-i18next";

export function EditForm({ onAddSuccess, onEditSuccess, ref }: PFormProps) {
  const { t } = useTranslation("common");
  const [form] = Form.useForm();

  return (
    <EditSheet
      form={form}
      ref={ref}
      title={t("media_config")}
      description={t("media_config_desc")}
      onSuccess={{
        add: onAddSuccess,
        edit: onEditSuccess,
      }}
      mutation={{
        add: AddRTMP,
        edit: EditMediaServer,
      }}
      trigger={<></>}
    >
      <Form.Item name="id" hidden>
        <Input />
      </Form.Item>

      <Form.Item
        label={t("ip")}
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
        label={t("gb_receive_address")}
        name="sdp_ip"
        rules={[
          { required: true, message: t("input_required") },
          { min: 2, max: 20, message: t("address_length") },
        ]}
      >
        <Input placeholder={t("input_gb_address")} />
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

      <Form.Item
        label={t("zlm_secret")}
        name="secret"
        rules={[
          { required: true, message: t("input_required") },
          { min: 2, max: 50, message: t("secret_length") },
        ]}
        tooltip={t("zlm_secret_desc")}
      >
        <Input placeholder={t("input_api_secret")} />
      </Form.Item>
    </EditSheet>
  );
}
