import React from "react";
import { Button } from "~/components/ui/button";
import { EditSheet, type PFormProps } from "~/components/xui/edit-sheet";
import { SquarePlus } from "lucide-react";
import { AddDevice, EditDevice } from "~/service/api/device/device";
import { Form, Input, Radio } from "antd";
import { useTranslation } from "react-i18next";

export function EditForm({ onAddSuccess, onEditSuccess, ref }: PFormProps) {
  const { t } = useTranslation("common");
  const [form] = Form.useForm();

  return (
    <EditSheet
      form={form}
      ref={ref}
      title={t("device_edit")}
      description={t("device_edit_desc")}
      onSuccess={{
        add: onAddSuccess,
        edit: onEditSuccess,
      }}
      mutation={{
        add: AddDevice,
        edit: EditDevice,
      }}
      trigger={
        <Button className="mx-3">
          <SquarePlus />
          {t("add_device")}
        </Button>
      }
    >
      <Form.Item name="id" hidden>
        <Input />
      </Form.Item>

      <Form.Item
        label={t("device_code")}
        name="device_id"
        rules={[
          { required: true, message: t("input_required") },
          { min: 18, max: 20, message: t("device_code_length") },
        ]}
      >
        <Input placeholder={t("input_device_code")} />
      </Form.Item>

      <Form.Item label={t("name")} name="name">
        <Input placeholder={t("input_device_name")} />
      </Form.Item>

      <Form.Item label={t("password")} name="password">
        <Input.Password placeholder={t("input_password_placeholder")} />
      </Form.Item>

      <Form.Item
        label={t("stream_receive_mode")}
        name="stream_mode"
        initialValue={0}
      >
        <Radio.Group size="middle">
          <Radio.Button value={0}>{t("udp")}</Radio.Button>
          <Radio.Button value={1}>{t("tcp_passive")}</Radio.Button>
          <Radio.Button value={2}>{t("tcp_active")}</Radio.Button>
        </Radio.Group>
      </Form.Item>
    </EditSheet>
  );
}
