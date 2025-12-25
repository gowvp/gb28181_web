import { Form, Input, InputNumber, Radio } from "antd";
import { SquarePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { EditSheet, type PFormProps } from "~/components/xui/edit-sheet";
import { AddProxy, EditProxy } from "~/service/api/rtsp/rtsp";

export function EditForm({ onAddSuccess, onEditSuccess, ref }: PFormProps) {
  const { t } = useTranslation("common");
  const [form] = Form.useForm();

  return (
    <EditSheet
      form={form}
      ref={ref}
      title={t("pull_info")}
      description={t("pull_info_desc")}
      onSuccess={{
        add: onAddSuccess,
        edit: onEditSuccess,
      }}
      mutation={{
        add: AddProxy,
        edit: EditProxy,
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

      <Form.Item name="app" hidden initialValue="pull">
        <Input />
      </Form.Item>

      <Form.Item name="stream" hidden initialValue="">
        <Input />
      </Form.Item>

      <Form.Item
        label={t("source_url")}
        name="source_url"
        rules={[
          { required: true, message: t("input_required") },
          { min: 10, message: t("source_url_min_length") },
        ]}
      >
        <Input placeholder="rtsp://..." />
      </Form.Item>

      <Form.Item
        label={t("pull_method")}
        name="transport"
        initialValue={0}
        rules={[{ required: true }]}
      >
        <Radio.Group size="middle">
          <Radio.Button value={0}>TCP</Radio.Button>
          <Radio.Button value={1}>UDP</Radio.Button>
        </Radio.Group>
      </Form.Item>

      <Form.Item
        label={t("timeout_s")}
        name="timeout_s"
        initialValue={10}
        rules={[
          { required: true, message: t("input_required") },
          { type: "number", min: 1, max: 100, message: t("timeout_range") },
        ]}
      >
        <InputNumber
          min={1}
          max={100}
          style={{ width: "100%" }}
          placeholder={t("input_timeout")}
        />
      </Form.Item>

      <Form.Item label={t("enabled")} name="enabled" initialValue={true}>
        <Radio.Group size="middle">
          <Radio.Button value={true}>{t("enable")}</Radio.Button>
          <Radio.Button value={false}>{t("disable")}</Radio.Button>
        </Radio.Group>
      </Form.Item>
    </EditSheet>
  );
}
