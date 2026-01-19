import { useQuery } from "@tanstack/react-query";
import { Form, Input, Radio, Select } from "antd";
import { SquarePlus } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { EditSheet, type EditSheetImpl, type PFormProps } from "~/components/xui/edit-sheet";
import { AddChannel, EditChannel } from "~/service/api/channel/channel";
import type {
  AddChannelInput,
  EditChannelInput,
} from "~/service/api/channel/state";
import { FindDevices, findDevicesKey } from "~/service/api/device/device";

// RTMP 通道添加（app/stream 由后端自动设置，不需要前端传入）
async function AddRTMP(data: {
  name?: string; // 备注（可选）
  is_auth_disabled: boolean;
  device_id?: string; // 设备 ID，空串表示新建设备
  device_name?: string; // 设备名称
}) {
  const input: AddChannelInput = {
    type: "RTMP",
    // 如果用户填了备注则用备注，否则由后端生成默认名称
    name: data.name || data.device_name || "RTMP 通道",
    // app/stream 由后端固定：app=push, stream=channel.id
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

// RTMP 通道编辑（仅支持修改鉴权和备注）
async function EditRTMP(
  id: string,
  data: { name?: string; is_auth_disabled?: boolean },
) {
  const input: EditChannelInput = {
    name: data.name,
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
  const [isEditMode, setIsEditMode] = useState(false);

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
    (opt) => opt.label === searchKey && !opt.disabled,
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
      | { label: string; isNew?: boolean }[],
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

  const originalRef = React.useRef<EditSheetImpl | null>(null);
  // 保存待编辑数据，用于设备列表加载完成后回显
  const pendingEditData = React.useRef<any>(null);

  // 当设备列表加载完成后，检查是否有待回显的数据
  React.useEffect(() => {
    if (pendingEditData.current && deviceOptions.length > 0) {
      const values = pendingEditData.current;
      const deviceName = deviceOptions.find(opt => opt.value === values.did)?.label || values.did || "";
      form.setFieldsValue({
        device_selector: deviceName,
      });
      pendingEditData.current = null;
    }
  }, [deviceOptions, form]);

  // 暴露给父组件的方法
  React.useImperativeHandle(ref, () => ({
    edit: (values: any) => {
      // 编辑模式时回显设备和备注
      if (values?.id) {
        setIsEditMode(true);
        // 先设置基础字段
        form.setFieldsValue({
          id: values.id,
          name: values.name || "",
          is_auth_disabled: values.config?.is_auth_disabled ?? false,
          device_id: values.did || "",
        });
        // 如果设备列表已加载，直接回显设备名称；否则保存待回显数据
        if (deviceOptions.length > 0) {
          const deviceName = deviceOptions.find(opt => opt.value === values.did)?.label || values.did || "";
          form.setFieldsValue({ device_selector: deviceName });
        } else {
          pendingEditData.current = values;
          // 先用 did 作为临时显示
          form.setFieldsValue({ device_selector: values.did || "" });
        }
        // 调用原始的 edit 方法打开弹窗
        originalRef.current?.edit(values);
      } else {
        setIsEditMode(false);
        form.resetFields();
        pendingEditData.current = null;
        originalRef.current?.edit(values);
      }
    },
  }));

  return (
    <EditSheet
      form={form}
      ref={originalRef}
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
      fieldsPerStep={3}
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

      {/* 设备选择（编辑时禁用） */}
      <Form.Item
        label={t("device")}
        name="device_selector"
        rules={[{ required: !isEditMode, message: "请选择或输入设备名称" }]}
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
          disabled={isEditMode}
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

      {/* 备注 */}
      <Form.Item label={t("remark")} name="name">
        <Input placeholder={t("optional")} />
      </Form.Item>

      {/* 推流鉴权 */}
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
