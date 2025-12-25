import { Form, Input, Radio } from "antd";
import { useTranslation } from "react-i18next";
import { EditSheet, type PFormProps } from "~/components/xui/edit-sheet";
import { EditMediaServer } from "~/service/api/media/media";
import { AddRTMP } from "~/service/api/rtmp/rtmp";

// 统一通过抽屉表单处理流媒体新增与编辑，减少新增/编辑逻辑分散导致的维护成本
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
      trigger={null}
    >
      <Form.Item
        label={t("media_type")}
        name="type"
        initialValue="zlm"
        rules={[{ required: true, message: t("input_required") }]}
        tooltip={t("media_type_desc")}
      >
        <Radio.Group optionType="button" buttonStyle="solid">
          <Radio.Button value="zlm">ZLM</Radio.Button>
          <Radio.Button value="lalmax">Lalmax</Radio.Button>
        </Radio.Group>
      </Form.Item>

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
    </EditSheet>
  );
}
