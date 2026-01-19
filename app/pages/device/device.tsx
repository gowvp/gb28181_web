import { Link, useNavigate } from "@tanstack/react-router";
import { Button as AntButton, Radio } from "antd";
import type { CheckboxGroupProps } from "antd/es/checkbox";
import type { ColumnsType } from "antd/es/table";
import { Edit, Folder, Wifi } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { formatDate } from "~/components/util/date";
import useDebounce from "~/components/util/debounce";
import { XButtonDelete } from "~/components/xui/button";
import type { EditSheetImpl } from "~/components/xui/edit-sheet";
import { TableQuery, type TableQueryRef } from "~/components/xui/table-query";
import {
  DelDevice,
  FindDevices,
  findDevicesKey,
} from "~/service/api/device/device";
import type { DeviceItem } from "~/service/api/device/state";
import DeviceDiscover from "../channels/device_discover";
import { EditForm } from "./edit";

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
      render(_value, record) {
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
      render(_value, record) {
        if (`${record.transport}${record.address}`.length > 1) {
          return (
            <span className="lowercase">{`${record.transport}://${record.address}`}</span>
          );
        }
        return "-";
      },
    },
    {
      title: t("common:manufacturer"),
      dataIndex: "manufacturer",
      key: "manufacturer",
      render(_value, record) {
        return record.ext.manufacturer;
      },
      minWidth: 100,
    },
    {
      title: t("common:stream_mode"),
      dataIndex: "stream_mode",
      key: "stream_mode",
      render(_value, record) {
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
      render(_value, record) {
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
              // 根据设备类型跳转到不同页面
              if (record.type === "RTMP") {
                navigate({ to: "/rtmps", search: { did: record.id } });
              } else if (record.type === "RTSP") {
                navigate({ to: "/rtsps", search: { did: record.id } });
              } else {
                navigate({
                  to: "/channels",
                  search: { device_id: record.device_id },
                });
              }
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
                type: record.type,
                ip: record.ip,
                port: record.port,
                username: record.username,
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
    { label: t("common:preview"), value: "/nchannels" },
    { label: t("common:recordings"), value: "/playback" },
    { label: t("common:management"), value: "/devices" },
  ];

  const discoverRef = useRef<any>(null);

  return (
    <div className="min-h-screen bg-transparent p-6">
      <div className="mx-auto flex flex-row  items-center mb-6 ">
        <div className="flex gap-2 justify-between w-full">
          <div className="flex flex-row gap-2">
            <Radio.Group
              value="/devices"
              options={options}
              onChange={(e) => {
                navigate({ to: e.target.value });
              }}
              block
              optionType="button"
              buttonStyle="solid"
            />

            <Link to="/gb/sip">
              <AntButton>{t("common:access_info")}</AntButton>
            </Link>

            <AntButton
              icon={<Wifi className="w-4 h-4" />}
              onClick={() => discoverRef.current?.open()}
            >
              {t("common:device_discover")}
            </AntButton>
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

      <DeviceDiscover ref={discoverRef} />
    </div>
  );
}
