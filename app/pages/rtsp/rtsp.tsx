import * as React from "react";
import type { ColumnsType } from "antd/es/table";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Edit, SquarePlay } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { EditForm } from "./edit";
import { useRef, useState } from "react";
import useDebounce from "~/components/util/debounce";
import { XButtonDelete } from "~/components/xui/button";
import { Play } from "~/service/api/channel/channel";
import { ErrorHandle } from "~/service/config/error";
import PlayBox, { type PlayBoxRef } from "../../components/xui/play";
import { formatDate } from "~/components/util/date";
import { Badge } from "~/components/ui/badge";
import type { EditSheetImpl } from "~/components/xui/edit-sheet";
import { TableQuery, type TableQueryRef } from "~/components/xui/table-query";
import { DelProxy, FindProxys, findProxysKey } from "~/service/api/rtsp/rtsp";
import type { RTSPItem } from "~/service/api/rtsp/state";

export default function RTSPView() {
  // =============== 状态定义 ===============
  const [selectedPlayID, setSelectedPlayID] = useState("");

  // refs
  const editFromRef = useRef<EditSheetImpl>(null);
  const playRef = useRef<PlayBoxRef>(null);
  const tableRef = useRef<TableQueryRef<RTSPItem>>(null);

  // =============== 查询与操作 ===============

  // 播放功能
  const { mutate: playMutate, isPending: playIsPending } = useMutation({
    mutationFn: Play,
    onSuccess(data) {
      playRef.current?.play(data.data.items[0].http_flv ?? "", data.data);
    },
    onError: ErrorHandle,
  });

  // =============== 表格列定义 ===============
  const columns: ColumnsType<RTSPItem> = [
    {
      title: "备注",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "应用名",
      dataIndex: "app",
      key: "app",
    },
    {
      title: "流 ID",
      dataIndex: "stream",
      key: "stream",
    },
    {
      title: "拉流状态",
      dataIndex: "status",
      key: "status",
      render: (value: string) => {
        let color = "";
        let text = "";
        if (value == "STOPPED") {
          color = "bg-orange-300";
          text = "NO";
        } else if (value == "PUSHING") {
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
      title: "流媒体",
      dataIndex: "media_server_id",
      key: "media_server_id",
      render: (value: string) => value || "-",
    },
    {
      title: "代理方式",
      dataIndex: "transport",
      key: "transport",
      render: (value: number) => {
        return value == 0 ? "TCP" : "UDP";
      },
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (created_at: string) => {
        return <div>{formatDate(created_at)}</div>;
      },
    },
    // {
    //   title: "停流时间",
    //   dataIndex: "stopped_at",
    //   key: "stopped_at",
    //   render: (stopped_at: string, record: RTMPItem) => {
    //     const color = record.pushed_at > stopped_at ? "text-gray-400" : "";
    //     return <div className={color}>{formatDate(stopped_at)}</div>;
    //   },
    // },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      render: (_, record) => (
        <div className="flex gap-0">
          <Button
            disabled={playIsPending}
            isLoading={playIsPending && selectedPlayID === record.id}
            onClick={() => {
              setSelectedPlayID(record.id);
              playMutate(record.id);
            }}
            variant="ghost"
            size="sm"
          >
            <SquarePlay className="h-4 w-4 mr-1" />
            播放
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
            编辑
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
          <span className="mr-3">搜索</span>
          <Input
            placeholder="可输入应用名/流 ID 模糊搜索"
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
        <PlayBox ref={playRef} />
      </div>
    </>
  );
}

// function PushAddrsButton({
//   children,
//   items,
// }: {
//   children: React.ReactNode;
//   items: string[];
// }) {
//   return (
//     <Popover>
//       <PopoverTrigger asChild>{children}</PopoverTrigger>
//       <PopoverContent className="w-80">
//         {items.map((item) => (
//           <Button className="w-full" key={item}>
//             {item}
//           </Button>
//         ))}
//       </PopoverContent>
//     </Popover>
//   );
// }
