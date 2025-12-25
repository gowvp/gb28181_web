import type { ColumnsType } from "antd/es/table";
import { Edit, SquarePlay } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import PlayDrawer, {
  type PlayDrawerRef,
} from "~/components/player/play-drawer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { formatDate } from "~/components/util/date";
import useDebounce from "~/components/util/debounce";
import { XButtonDelete } from "~/components/xui/button";
import type { EditSheetImpl } from "~/components/xui/edit-sheet";
import { TableQuery, type TableQueryRef } from "~/components/xui/table-query";
import { DelProxy, FindProxys, findProxysKey } from "~/service/api/rtsp/rtsp";
import type { RTSPItem } from "~/service/api/rtsp/state";
import { EditForm } from "./edit";

export default function RTSPView() {
  const { t } = useTranslation("common");

  // =============== 状态定义 ===============

  // refs
  const editFromRef = useRef<EditSheetImpl>(null);
  const playRef = useRef<PlayDrawerRef>(null);
  const tableRef = useRef<TableQueryRef<RTSPItem>>(null);

  // =============== 查询与操作 ===============

  // =============== 表格列定义 ===============
  const columns: ColumnsType<RTSPItem> = [
    {
      title: t("remark"),
      dataIndex: "name",
      key: "name",
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
      title: t("pull_status"),
      dataIndex: "status",
      key: "status",
      render: (value: string) => {
        let color = "";
        let text = "";
        if (value === "STOPPED") {
          color = "bg-orange-300";
          text = "NO";
        } else if (value === "PUSHING") {
          color = "bg-green-300";
          text = "OK";
        }

        return text ? (
          <Badge variant="secondary" className={`${color} text-white`}>
            {text}
          </Badge>
        ) : (
          <span></span>
        );
      },
    },
    {
      title: t("media_server"),
      dataIndex: "media_server_id",
      key: "media_server_id",
      render: (value: string) => value || "-",
    },
    {
      title: t("proxy_method"),
      dataIndex: "transport",
      key: "transport",
      render: (value: number) => {
        return value === 0 ? "TCP" : "UDP";
      },
    },
    {
      title: t("create_time"),
      dataIndex: "created_at",
      key: "created_at",
      render: (created_at: string) => {
        return <div>{formatDate(created_at)}</div>;
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
                transport: record.transport,
                enabled: record.enabled,
                timeout_s: record.timeout_s,
                source_url: record.source_url,
              })
            }
          >
            <Edit className="h-4 w-4 mr-1" />
            {t("edit")}
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
    tableRef.current?.setFilters((prev: any) => ({ ...prev, page: 1, key }));
  }, 500);

  return (
    <>
      {/* <XHeader items={[{ title: "拉流代理", url: "rtsps" }]} /> */}

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
          queryKey={findProxysKey}
          fetchFn={FindProxys}
          deleteFn={DelProxy}
          columns={columns}
        />

        {/* 播放器 */}
        <PlayDrawer ref={playRef} />
      </div>
    </>
  );
}
