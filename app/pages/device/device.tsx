import { Link, useNavigate } from "react-router";
import { Button as AntButton } from "antd";
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
                navigate(`/rtmps?did=${encodeURIComponent(record.id)}`);
              } else if (record.type === "RTSP") {
                navigate(`/rtsps?did=${encodeURIComponent(record.id)}`);
              } else {
                navigate(`/channels?did=${encodeURIComponent(record.id)}`);
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

  const options: { label: string; value: string }[] = [
    { label: t("common:preview"), value: "/nchannels" },
    { label: t("common:recordings"), value: "/playback" },
    { label: t("common:management"), value: "/devices" },
  ];

  const discoverRef = useRef<any>(null);

  return (
    <div className="min-h-screen bg-transparent p-6">
      <div className="mb-6 flex flex-row gap-2 items-center justify-between w-full">
          <div className="flex flex-row gap-2 items-center">
            {/* Apple Segment Control */}
            <div
              style={{
                display: "inline-flex",
                background: "rgba(0,0,0,0.06)",
                borderRadius: 9,
                padding: 2,
                gap: 0,
              }}
            >
              {options.map((opt) => {
                const active = opt.value === "/devices";
                return (
                  <button
                    key={opt.value as string}
                    type="button"
                    onClick={() => navigate(opt.value as string)}
                    style={{
                      height: 28,
                      padding: "0 14px",
                      borderRadius: 7,
                      fontSize: 13,
                      fontWeight: 500,
                      color: active ? "#1d1d1f" : "#6e6e73",
                      background: active ? "#fff" : "transparent",
                      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12), 0 0.5px 0 rgba(0,0,0,0.06)" : "none",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
                      whiteSpace: "nowrap",
                      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
                    }}
                  >
                    {opt.label as string}
                  </button>
                );
              })}
            </div>

            <Link to="/gb/sip">
              <AntButton
                style={{
                  padding: "0 16px",
                  height: 32,
                  borderRadius: 9999,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#6e6e73",
                  background: "transparent",
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "none",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {t("common:access_info")}
              </AntButton>
            </Link>

            <AntButton
              icon={<Wifi style={{ width: 14, height: 14 }} />}
              onClick={() => discoverRef.current?.open()}
              style={{
                padding: "0 16px",
                height: 32,
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 500,
                color: "#6e6e73",
                background: "transparent",
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "none",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {t("common:device_discover")}
            </AntButton>
          </div>

          {/* 搜索和添加区域 */}
          <div className="flex items-center gap-2">
            <Input
              placeholder={t("common:search_device_placeholder")}
              onChange={(event) => debouncedFilters(event.target.value)}
              className="w-56"
              style={{
                height: 32,
                borderRadius: 9999,
                background: "rgba(255,255,255,0.65)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(0,0,0,0.08)",
                fontSize: 13,
                color: "#1d1d1f",
                boxShadow: "none",
              }}
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

      <div
        className="rounded-[20px] overflow-hidden"
        style={{
          background: "rgba(255, 255, 255, 0.70)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.6)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
          paddingRight: 12,
        }}
      >
        <TableQuery
          ref={tableRef}
          queryKey={findDevicesKey}
          fetchFn={FindDevices}
          deleteFn={DelDevice}
          columns={columns}
        />
      </div>

      <DeviceDiscover ref={discoverRef} />
    </div>
  );
}
