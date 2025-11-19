import * as React from "react";
import type { ColumnsType } from "antd/es/table";
import { Button } from "~/components/ui/button";
import { Button as AntButton } from "antd";
import { Input } from "~/components/ui/input";
import { Edit, Folder } from "lucide-react";
import { useRef } from "react";
import useDebounce from "~/components/util/debounce";
import { XButtonDelete } from "~/components/xui/button";
import { formatDate } from "~/components/util/date";
import type { EditSheetImpl } from "~/components/xui/edit-sheet";
import { TableQuery, type TableQueryRef } from "~/components/xui/table-query";
import { EditForm } from "./edit";
import type { DeviceItem } from "~/service/api/device/state";
import {
  DelDevice,
  FindDevices,
  findDevicesKey,
} from "~/service/api/device/device";
import { Badge } from "~/components/ui/badge";
import { Link, useNavigate } from "react-router";
import { Radio } from "antd";
import type { CheckboxGroupProps } from "antd/es/checkbox";
import { useTranslation } from "react-i18next";

export default function DeviceView() {
  const { t } = useTranslation(["device", "common"]);
  const navigate = useNavigate();
  // refs
  const editFromRef = useRef<EditSheetImpl>(null);
  const tableRef = useRef<TableQueryRef<DeviceItem>>(null);

  // =============== 表格列定义 ===============
  const columns: ColumnsType<DeviceItem> = [
    {
      title: t("common:name"),
      dataIndex: "name",
      key: "name",
      minWidth: 100,
      render(value, record) {
        let name = record.name;
        // 用户未自定义名称，采用设备上报名称
        if (name.length <= 0) {
          name = record.ext.name;
        }
        return <div>{name}</div>;
      },
    },
    {
      title: t("common:device_number"),
      dataIndex: "device_id",
      key: "device_id",
      minWidth: 180,
    },
    {
      title: t("common:address"),
      dataIndex: "address",
      key: "address",
      minWidth: 180,
      render(value, record) {
        return (
          <span className="lowercase">{`${record.trasnport}://${record.address}`}</span>
        );
      },
    },
    {
      title: t("common:manufacturer"),
      dataIndex: "manufacturer",
      key: "manufacturer",
      render(value, record) {
        return record.ext.manufacturer;
      },
      minWidth: 100,
    },
    {
      title: t("common:stream_mode"),
      dataIndex: "stream_mode",
      key: "stream_mode",
      render(value, record) {
        return record.stream_mode === 0
          ? t("common:udp")
          : record.stream_mode === 1
          ? t("common:tcp_passive")
          : t("common:tcp_active");
      },
    },
    {
      title: t("common:channel_count"),
      dataIndex: "channels",
      key: "channels",
      minWidth: 80,
    },
    {
      title: t("common:status"),
      dataIndex: "is_online",
      align: "center",
      key: "is_online",
      render(value, record) {
        return (
          <Badge
            variant="secondary"
            className={`${
              record.is_online ? "bg-green-300" : "bg-orange-300"
            } text-white`}
          >
            {record.is_online ? t("common:online") : t("common:offline")}
          </Badge>
        );
      },
      minWidth: 80,
    },
    {
      title: t("common:subscribe"),
      minWidth: 80,
    },

    {
      title: t("common:recent_heartbeat"),
      dataIndex: "keepalive_at",
      key: "keepalive_at",
      render: (pushed_at: string) => {
        return <div>{formatDate(pushed_at)}</div>;
      },
    },

    {
      title: t("common:recent_register"),
      dataIndex: "registered_at",
      key: "registered_at",
      render: (pushed_at: string) => {
        return <div>{formatDate(pushed_at)}</div>;
      },
    },

    {
      title: t("common:operation"),
      key: "action",
      fixed: "right",
      render: (_, record: DeviceItem) => (
        <div className="flex gap-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigate(`/channels?device_id=${record.device_id}`);
            }}
          >
            <Folder className="h-4 w-4 mr-1" />
            {t("common:channel")}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              editFromRef.current?.edit({
                id: record.id,
                name: record.name,
                device_id: record.device_id,
                password: record.password,
                stream_mode: record.stream_mode,
              })
            }
          >
            <Edit className="h-4 w-4 mr-1" />
            {t("common:edit")}
          </Button>

          {/* todo: 删除 loading 状态 */}
          <XButtonDelete
            onConfirm={() => {
              tableRef.current?.delMutate(record.id);
            }}
            // isLoading={tableRef.current?.delIsPending}
          />
        </div>
      ),
    },
  ];

  // 搜索防抖
  const debouncedFilters = useDebounce((key: string) => {
    tableRef.current?.setFilters((prev: any) => ({
      ...prev,
      page: 1,
      key,
    }));
  }, 500);

  // const [isShowFilter, setIsShowFilter] = useState(true);

  const options: CheckboxGroupProps<string>["options"] = [
    { label: t("common:client_side"), value: "/nchannels" },
    { label: t("common:management_side"), value: "/devices" },
  ];

  return (
    <>
      <div className="min-h-screen bg-transparent p-6">
        <div className="mx-auto flex flex-row  items-center mb-6 ">
          <div className="flex gap-2 justify-between w-full">
            <div className="flex flex-row gap-2">
              <Radio.Group
                value="/devices"
                options={options}
                onChange={(e) => {
                  navigate(e.target.value);
                }}
                block
                optionType="button"
                buttonStyle="solid"
              />

              <Link to="/gb/sip">
                <AntButton>{t("common:access_info")}</AntButton>
              </Link>
            </div>

            {/* 搜索和添加区域 */}
            <div className="flex items-center">
              <span className="mr-3">{t("common:search")}</span>
              <Input
                placeholder={t("common:search_device_placeholder")}
                onChange={(event) => debouncedFilters(event.target.value)}
                className="w-60"
              />

              <EditForm
                ref={editFromRef}
                onAddSuccess={() => tableRef.current?.handleAddSuccess()}
                onEditSuccess={(data) =>
                  tableRef.current?.handleEditSuccess(data)
                }
              />
            </div>
          </div>
        </div>

        {/* <div
          className={cn(
            "mb-4 flex justify-start transition-all duration-300 overflow-hidden",
            isShowFilter ? "max-h-[300px]" : "max-h-0"
          )}
        >
          <ToggleGroup
            type="single"
            // value={filters.is_online}
            onValueChange={(value) => {
              tableRef.current?.setFilters((prev: any) => ({
                ...prev,
                page: 1,
                is_online: value,
              }));
            }}
          >
            <ToggleGroupItem
              value="all"
              className="text-[#555] data-[state=on]:text-[#555]"
            >
              全部状态
            </ToggleGroupItem>
            <ToggleGroupItem
              value="true"
              className="text-[#555] data-[state=on]:text-[#555]"
            >
              在线
            </ToggleGroupItem>
            <ToggleGroupItem
              value="false"
              className="text-[#555] data-[state=on]:text-[#555]"
            >
              离线
            </ToggleGroupItem>
          </ToggleGroup>
        </div> */}

        <TableQuery
          ref={tableRef}
          queryKey={findDevicesKey}
          fetchFn={FindDevices}
          deleteFn={DelDevice}
          columns={columns}
        />
      </div>
    </>
  );
}
