import { useQuery } from "@tanstack/react-query";
import { Form, Input, Radio, Select } from "antd";
import { SquarePlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { EditSheet, type PFormProps } from "~/components/xui/edit-sheet";
import { AddChannel, EditChannel } from "~/service/api/channel/channel";
import type {
  AddChannelInput,
  EditChannelInput,
} from "~/service/api/channel/state";
import { FindDevices, findDevicesKey } from "~/service/api/device/device";

// 适配旧的接口格式
async function AddRTMP(data: {
  app: string;
  stream: string;
  is_auth_disabled: boolean;
  device_id?: string; // 设备 ID，空串表示新建设备
  device_name?: string; // 设备名称
}) {
  const input: AddChannelInput = {
    type: "RTMP",
    name: `${data.app}/${data.stream}`,
    app: data.app,
    stream: data.stream,
    config: {
      is_auth_disabled: data.is_auth_disabled,
    },
  };

  // device_id 为空串时表示创建新设备，使用 device_name
  // device_id 有值时表示选择已有设备
  if (data.device_id) {
    input.device_id = data.device_id;
  } else if (data.device_name) {
    input.device_name = data.device_name;
  }

  return await AddChannel(input);
}

async function EditRTMP(
  id: string,
  data: { app?: string; stream?: string; is_auth_disabled?: boolean }
) {
  const input: EditChannelInput = {
    app: data.app,
    stream: data.stream,
    config: {
      is_auth_disabled: data.is_auth_disabled,
    },
  };
  return await EditChannel(id, input);
}

export function EditForm({ onAddSuccess, onEditSuccess, ref }: PFormProps) {
  const { t } = useTranslation("common");
  const [form] = Form.useForm();
  const [searchKey, setSearchKey] = useState("");

  // 查询所有设备列表
  const { data: devicesData } = useQuery({
    queryKey: [findDevicesKey, "all", searchKey],
    queryFn: () => FindDevices({ page: 1, size: 50, key: searchKey }),
  });

  // 根据 ID 前缀判断设备类型：gb/ch 是国标，on/pr 是 ONVIF
  const isGBOrOnvifDevice = (id: string) => {
    const prefix = id.substring(0, 2).toLowerCase();
    return ["gb", "ch", "on", "pr"].includes(prefix);
  };

  // 将设备列表转换为 Select 选项，国标和 ONVIF 设备禁用
  const deviceOptions =
    devicesData?.data.items?.map((device) => {
      const isDisabled = isGBOrOnvifDevice(device.id);
      const deviceType = isDisabled
        ? ["gb", "ch"].includes(device.id.substring(0, 2).toLowerCase())
          ? "GB28181"
          : "ONVIF"
        : device.type || "RTMP";
      const displayName = device.name || device.ext.name || device.device_id;
      return {
        value: device.id, // 设备 ID
        label: displayName, // 设备名称
        disabled: isDisabled,
        type: deviceType,
      };
    }) || [];

  // 支持输入新设备名称（创建新设备）
  // 当有搜索词且不匹配现有设备时，显示创建新设备选项
  // 新设备用空串作为 value，label 为输入的名称，只能有一个空串 value
  const hasExactMatch = deviceOptions.some(
    (opt) => opt.label === searchKey && !opt.disabled
  );

  // 构建选项列表：如果有搜索词且无精确匹配，在最前面添加创建新设备选项
  const allOptions = (() => {
    const baseOptions = deviceOptions.map((opt) => ({
      ...opt,
      isNew: false,
    }));

    if (searchKey && !hasExactMatch) {
      return [
        {
          value: "", // 空串表示新建设备，只有一个
          label: searchKey, // 直接显示输入的名称
          disabled: false,
          type: "NEW",
          isNew: true,
        },
        ...baseOptions,
      ];
    }
    return baseOptions;
  })();

  // 处理选择变化，设置 device_id 和 device_name
  const handleSelectChange = (
    value: string,
    option?:
      | { label: string; isNew?: boolean }
      | { label: string; isNew?: boolean }[]
  ) => {
    const opt = Array.isArray(option) ? option[0] : option;
    const isNewDevice = opt?.isNew || value === "";
    const deviceName = opt?.label || searchKey;

    form.setFieldsValue({
      device_id: value, // 空串或设备 ID
      device_name: deviceName, // 设备名称
      device_selector: isNewDevice ? deviceName : value, // 保持选择器显示正确的值
    });

    // 创建新设备时不清空 searchKey，保持输入框显示
    if (!isNewDevice) {
      setSearchKey("");
    }
  };

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
      <Form.Item name="device_id" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="device_name" hidden>
        <Input />
      </Form.Item>

      {/* 第一步：设备选择 + 推流鉴权 */}
      <Form.Item
        label="设备"
        name="device_selector"
        rules={[{ required: true, message: "请选择或输入设备名称" }]}
        tooltip="选择已有 RTMP 设备或输入新设备名称进行创建，国标/ONVIF 设备不可选"
      >
        <Select
          showSearch
          placeholder="搜索或输入新设备名称"
          allowClear
          filterOption={false}
          onSearch={setSearchKey}
          onChange={handleSelectChange}
          optionLabelProp="label"
        >
          {allOptions.map((opt) => (
            <Select.Option
              key={opt.isNew ? "new-device" : opt.value}
              value={opt.value}
              label={opt.label}
              disabled={opt.disabled}
              isNew={opt.isNew}
            >
              {opt.label}
              {opt.disabled && (
                <span className="text-gray-400 ml-2">({opt.type})</span>
              )}
              {opt.isNew && <span className="text-blue-500 ml-2">(新建)</span>}
            </Select.Option>
          ))}
        </Select>
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

      {/* 第二步：应用名 + 流 ID */}
      <Form.Item
        label={t("app")}
        name="app"
        initialValue="live"
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
    </EditSheet>
  );
}
