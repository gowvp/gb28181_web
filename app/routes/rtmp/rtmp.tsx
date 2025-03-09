import * as React from "react";
import type { ColumnsType } from "antd/es/table";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Copy, Edit, SquarePlay } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { DelRTMP, FindRTMPs, findRTMPsKey } from "~/service/api/rtmp/rtmp";
import type { RTMPItem } from "~/service/api/rtmp/rtmp.d";
import { EditForm } from "./edit";
import { useRef, useState } from "react";
import useDebounce from "~/components/util/debounce";
import { XButtonDelete } from "~/components/xui/button";
import { Play } from "~/service/api/channel/channel";
import { ErrorHandle } from "~/service/error";
import PlayBox, { type PlayBoxRef } from "../../components/xui/play";
import { formatDate } from "~/components/util/date";
import { Badge } from "~/components/ui/badge";
import { copy2Clipboard } from "~/components/util/copy";
import type { EditSheetImpl } from "~/components/xui/edit-sheet";
import { TableQuery, type TableQueryRef } from "~/components/xui/table-query";
import ToolTips from "~/components/xui/tips";
import XHeader from "~/components/xui/header";

export default function RTMPView() {
  // =============== 状态定义 ===============
  const [selectedPlayID, setSelectedPlayID] = useState("");

  // refs
  const editFromRef = useRef<EditSheetImpl>(null);
  const playRef = useRef<PlayBoxRef>(null);
  const tableRef = useRef<TableQueryRef<RTMPItem>>(null);

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
  const columns: ColumnsType<RTMPItem> = [
    {
      title: "名称",
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
      title: "推流状态",
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
      title: "推流时间",
      dataIndex: "pushed_at",
      key: "pushed_at",
      render: (pushed_at: string, record: RTMPItem) => {
        const color = pushed_at < record.stopped_at ? "text-gray-400" : "";
        return <div className={color}>{formatDate(pushed_at)}</div>;
      },
    },
    {
      title: "停流时间",
      dataIndex: "stopped_at",
      key: "stopped_at",
      render: (stopped_at: string, record: RTMPItem) => {
        const color = record.pushed_at > stopped_at ? "text-gray-400" : "";
        return <div className={color}>{formatDate(stopped_at)}</div>;
      },
    },
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
                is_auth_disabled: record.is_auth_disabled,
              })
            }
          >
            <Edit className="h-4 w-4 mr-1" />
            编辑
          </Button>

          <ToolTips
            disabled={!record.is_auth_disabled}
            tips="橘色表示不安全的，推流不鉴权"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const value = record.push_addrs[0];
                copy2Clipboard(value, {
                  title: "推流地址已复制",
                  description: value,
                });
              }}
            >
              <Copy
                className="h-4 w-4 mr-1"
                color={record.is_auth_disabled ? "orange" : "#000"}
              />
              RTMP
            </Button>
          </ToolTips>

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
      {/* <XHeader items={[{ title: "推流列表", url: "rtmps" }]} /> */}

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
          queryKey={findRTMPsKey}
          fetchFn={FindRTMPs}
          deleteFn={DelRTMP}
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
