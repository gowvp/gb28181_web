import { useQuery } from "@tanstack/react-query";
import { Form, Input, InputNumber, Radio, Select } from "antd";
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

// RTSP 通道添加（app/stream 由后端自动设置：app=pull, stream=channel.id）
async function AddProxy(data: {
  source_url: string;
  transport: number;
  timeout_s: number;
  enabled: boolean;
  name?: string; // 备注（可选）
  device_id?: string; // 设备 ID，空串表示新建设备
  device_name?: string; // 设备名称
}) {
  const input: AddChannelInput = {
    type: "RTSP",
    // 如果用户填了备注则用备注，否则用 RTSP URL 作为默认名称
    name: data.name || data.source_url,
    // app/stream 由后端固定：app=pull, stream=channel.id
    config: {
      source_url: data.source_url,
      transport: data.transport,
      timeout_s: data.timeout_s,
      enabled: data.enabled,
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

// RTSP 通道编辑（仅支持修改 URL、传输方式、超时、启用状态和备注）
async function EditProxy(
  id: string,
  data: {
    source_url?: string;
    transport?: number;
    timeout_s?: number;
    enabled?: boolean;
    name?: string;
  }
) {
  const input: EditChannelInput = {
    name: data.name,
    config: {
      source_url: data.source_url,
      transport: data.transport,
      timeout_s: data.timeout_s,
      enabled: data.enabled,
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
        : device.type || "RTSP";
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
      title={t("pull_info")}
      description={t("pull_info_desc")}
      fieldsPerStep={3}
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
      <Form.Item name="device_id" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="device_name" hidden>
        <Input />
      </Form.Item>

      {/* 第一步：设备选择 + 是否启用 */}
      <Form.Item
        label="设备"
        name="device_selector"
        rules={[{ required: true, message: "请选择或输入设备名称" }]}
        tooltip="选择已有 RTSP 设备或输入新设备名称进行创建，国标/ONVIF 设备不可选"
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

      <Form.Item label={t("enabled")} name="enabled" initialValue={true}>
        <Radio.Group size="middle">
          <Radio.Button value={true}>{t("enable")}</Radio.Button>
          <Radio.Button value={false}>{t("disable")}</Radio.Button>
        </Radio.Group>
      </Form.Item>

      {/* 第二步：拉流地址 + 备注 */}
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

      <Form.Item label={t("remark")} name="name">
        <Input placeholder={t("optional")} />
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
    </EditSheet>
  );
}
