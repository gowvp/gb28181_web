import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import type { ColumnsType } from "antd/es/table";
import { Copy, Edit, SquarePlay } from "lucide-react";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import PlayDrawer, {
  type PlayDrawerRef,
} from "~/components/player/play-drawer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { copy2Clipboard } from "~/components/util/copy";
import { formatDate } from "~/components/util/date";
import useDebounce from "~/components/util/debounce";
import { XButtonDelete } from "~/components/xui/button";
import type { EditSheetImpl } from "~/components/xui/edit-sheet";
import { TableQuery, type TableQueryRef } from "~/components/xui/table-query";
import ToolTips from "~/components/xui/tips";
import {
  DelChannel,
  FindChannels,
  findChannelsKey,
} from "~/service/api/channel/channel";
import type { ChannelItem } from "~/service/api/channel/state";
import { FindDevices, findDevicesKey } from "~/service/api/device/device";
import { EditForm } from "./edit";

// 适配旧的 RTMPItem 类型，从 ChannelItem 提取 RTMP 相关字段
type RTMPItem = ChannelItem;

export default function RTMPView() {
  const { t } = useTranslation("common");
  // 从 URL 获取 did 参数，用于过滤特定设备下的通道
  const searchParams = useSearch({ strict: false }) as { did?: string };

  // =============== 状态定义 ===============

  // refs
  const editFromRef = useRef<EditSheetImpl>(null);
  const playRef = useRef<PlayDrawerRef>(null);
  const tableRef = useRef<TableQueryRef<RTMPItem>>(null);

  // 查询 RTMP 类型设备列表，用于显示设备名称
  const { data: devicesData } = useQuery({
    queryKey: [findDevicesKey, "RTMP"],
    queryFn: () => FindDevices({ page: 1, size: 100, type: "RTMP" }),
  });

  // 建立 did -> deviceName 映射
  const deviceNameMap = useMemo(() => {
    const map = new Map<string, string>();
    devicesData?.data.items?.forEach((device) => {
      map.set(device.id, device.name || device.ext.name || device.device_id);
    });
    return map;
  }, [devicesData]);

  // =============== 查询包装函数 ===============
  // 添加 type=RTMP 参数进行过滤，如果有 did 参数则同时过滤设备
  const fetchRTMPs = async (params: object) => {
    const filters: Record<string, unknown> = { ...params, type: "RTMP" };
    if (searchParams.did) {
      filters.did = searchParams.did;
    }
    return await FindChannels(filters);
  };

  // =============== 表格列定义 ===============
  const columns: ColumnsType<RTMPItem> = [
    {
      title: t("name"),
      dataIndex: "name",
      key: "name",
    },
    {
      title: t("device"),
      key: "device_name",
      render: (_: unknown, record: RTMPItem) =>
        deviceNameMap.get(record.did) || "-",
    },
    {
      title: t("app_name"),
      dataIndex: "app",
      key: "app",
    },
    {
      title: t("stream_id"),
      dataIndex: "stream",
      key: "stream",
    },
    {
      title: t("push_status"),
      key: "status",
      render: (_: unknown, record: RTMPItem) => {
        const isOnline = record.is_online;
        const color = isOnline ? "bg-green-300" : "bg-orange-300";
        const text = isOnline ? t("pushing") : t("not_pushing");
        const shortText = isOnline ? "ON" : "OFF";

        return (
          <Badge
            variant="secondary"
            className={`${color} text-white`}
            title={text}
          >
            {shortText}
          </Badge>
        );
      },
    },
    {
      title: t("media_server"),
      key: "media_server_id",
      render: (_: unknown, record: RTMPItem) =>
        record.config?.media_server_id || "-",
    },
    {
      title: t("push_time"),
      key: "pushed_at",
      render: (_: unknown, record: RTMPItem) => {
        const pushed_at = record.config?.pushed_at;
        const stopped_at = record.config?.stopped_at;
        if (!pushed_at) return "-";
        const color =
          stopped_at && pushed_at < stopped_at ? "text-gray-400" : "";
        return <div className={color}>{formatDate(pushed_at)}</div>;
      },
    },
    {
      title: t("stop_time"),
      key: "stopped_at",
      render: (_: unknown, record: RTMPItem) => {
        const pushed_at = record.config?.pushed_at;
        const stopped_at = record.config?.stopped_at;
        if (!stopped_at) return "-";
        const color =
          pushed_at && pushed_at > stopped_at ? "text-gray-400" : "";
        return <div className={color}>{formatDate(stopped_at)}</div>;
      },
    },
    {
      title: t("operation"),
      key: "action",
      fixed: "right",
      render: (_, record) => (
        <div className="flex gap-0">
          <Button
            onClick={() => {
              playRef.current?.open(record, { hideSidebar: true });
            }}
            variant="ghost"
            size="sm"
          >
            <SquarePlay className="h-4 w-4 mr-1" />
            {t("play")}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              editFromRef.current?.edit({
                id: record.id,
                app: record.app,
                stream: record.stream,
                is_auth_disabled: record.config?.is_auth_disabled,
              })
            }
          >
            <Edit className="h-4 w-4 mr-1" />
            {t("edit")}
          </Button>

          <ToolTips
            disabled={!record.config?.is_auth_disabled}
            tips="橘色表示不安全的，推流不鉴权"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // 构造推流地址
                const pushAddr = `rtmp://your-server:1935/${record.app}/${record.stream}`;
                copy2Clipboard(pushAddr, {
                  title: "推流地址已复制",
                  description: pushAddr,
                });
              }}
            >
              <Copy
                className="h-4 w-4 mr-1"
                color={record.config?.is_auth_disabled ? "orange" : "#000"}
              />
              RTMP
            </Button>
          </ToolTips>

          <XButtonDelete
            onConfirm={() => {
              tableRef.current?.delMutate(record.id);
            }}
          />
        </div>
      ),
    },
  ];

  // 搜索防抖
  const debouncedFilters = useDebounce((key: string) => {
    tableRef.current?.setFilters((prev: object) => ({ ...prev, page: 1, key }));
  }, 500);

  return (
    <>
      <div className="w-full bg-white p-4 rounded-lg">
        {/* 搜索和添加区域 */}
        <div className="flex justify-end items-center py-4">
          <span className="mr-3">{t("search")}</span>
          <Input
            placeholder={t("placeholder_search")}
            onChange={(event) => debouncedFilters(event.target.value)}
            className="w-56"
          />

          <EditForm
            ref={editFromRef}
            onAddSuccess={() => tableRef.current?.handleAddSuccess()}
            onEditSuccess={(data) => tableRef.current?.handleEditSuccess(data)}
          />
        </div>

        <TableQuery
          ref={tableRef}
          queryKey={findChannelsKey}
          fetchFn={fetchRTMPs}
          deleteFn={DelChannel}
          columns={columns}
        />

        {/* 播放器 */}
        <PlayDrawer ref={playRef} />
      </div>
    </>
  );
}
