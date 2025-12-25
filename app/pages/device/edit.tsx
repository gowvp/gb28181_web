import { Form, Input, InputNumber, Radio } from "antd";
import { SquarePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { EditSheet, type PFormProps } from "~/components/xui/edit-sheet";
import { AddDevice, EditDevice } from "~/service/api/device/device";

export function EditForm({ onAddSuccess, onEditSuccess, ref }: PFormProps) {
  const { t } = useTranslation("common");
  const [form] = Form.useForm();

  // 使用 Form.useWatch 监听 type 字段，自动响应变化
  const deviceType = Form.useWatch("type", form);
  const isOnvif = deviceType === "ONVIF";

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
      <Form.Item name="id" label={t("id")}>
        <Input disabled />
      </Form.Item>

      <Form.Item
        label={t("device_code")}
        name="device_id"
        hidden={isOnvif}
        rules={
          isOnvif
            ? []
            : [
                { required: true, message: t("input_required") },
                { min: 18, max: 20, message: t("device_code_length") },
              ]
        }
      >
        <Input placeholder={t("input_device_code")} />
      </Form.Item>

      <Form.Item label={t("name")} name="name">
        <Input placeholder={t("input_device_name")} />
      </Form.Item>

      <Form.Item hidden={!isOnvif} label={t("ip")} name="ip" required={isOnvif}>
        <Input placeholder={"192.168.1.2"} />
      </Form.Item>
      <Form.Item
        hidden={!isOnvif}
        label={t("port")}
        name="port"
        required={isOnvif}
      >
        <InputNumber
          min={1}
          max={65535}
          style={{ width: "100%" }}
          placeholder={"8000"}
        />
      </Form.Item>

      <Form.Item
        hidden={!isOnvif}
        label={t("username")}
        name="username"
        required={isOnvif}
      >
        <Input placeholder={"admin"} />
      </Form.Item>

      <Form.Item label={t("password")} name="password" required={isOnvif}>
        <Input.Password placeholder={t("input_password_placeholder")} />
      </Form.Item>

      <Form.Item
        label={t("stream_receive_mode")}
        name="stream_mode"
        initialValue={0}
        hidden={isOnvif}
      >
        <Radio.Group size="middle">
          <Radio.Button value={0}>{t("udp")}</Radio.Button>
          <Radio.Button value={1}>{t("tcp_passive")}</Radio.Button>
          <Radio.Button value={2}>{t("tcp_active")}</Radio.Button>
        </Radio.Group>
      </Form.Item>

      <Form.Item hidden name="type" initialValue="GB28181">
        <Input />
      </Form.Item>
    </EditSheet>
  );
}
