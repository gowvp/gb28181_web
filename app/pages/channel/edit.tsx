import React from "react";
import { Button } from "~/components/ui/button";
import { AddRTMP, EditRTMP } from "~/service/api/rtmp/rtmp";
import { EditSheet, type PFormProps } from "~/components/xui/edit-sheet";
import { SquarePlus } from "lucide-react";
import { Form, Input, Radio } from "antd";
import { useTranslation } from "react-i18next";

export function EditForm({ onAddSuccess, onEditSuccess, ref }: PFormProps) {
  const { t } = useTranslation("common");
  const [form] = Form.useForm();

  return (
    <EditSheet
      form={form}
      ref={ref}
      title={t("push_info")}
      description={t("push_info_desc")}
      onSuccess={{
        add: onAddSuccess,
        edit: onEditSuccess,
      }}
      mutation={{
        add: AddRTMP,
        edit: EditRTMP,
      }}
      trigger={
        <Button className="mx-3">
          <SquarePlus />
          {t("add_channel")}
        </Button>
      }
    >
      <Form.Item name="id" hidden>
        <Input />
      </Form.Item>

      <Form.Item
        label={t("app")}
        name="app"
        initialValue="push"
        rules={[
          { required: true, message: t("input_required") },
          { min: 2, max: 20, message: t("app_name_length") },
        ]}
      >
        <Input placeholder={t("input_app_name")} />
      </Form.Item>

      <Form.Item
        label={t("stream")}
        name="stream"
        rules={[
          { required: true, message: t("input_required") },
          { min: 2, max: 20, message: t("stream_id_length") },
        ]}
      >
        <Input placeholder={t("input_stream_id")} />
      </Form.Item>

      <Form.Item
        label={t("push_auth")}
        name="is_auth_disabled"
        initialValue={false}
        tooltip={t("push_auth_tip")}
      >
        <Radio.Group size="middle">
          <Radio.Button value={false}>{t("enable")}</Radio.Button>
          <Radio.Button value={true}>{t("disable")}</Radio.Button>
        </Radio.Group>
      </Form.Item>
    </EditSheet>
  );
}
