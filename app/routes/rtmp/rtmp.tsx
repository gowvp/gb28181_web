import * as React from "react";
import type { ColumnsType } from "antd/es/table";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Copy, Edit, SquarePlay } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DelRTMP, FindRTMPs, findRTMPsKey } from "~/service/api/rtmp";
import type { RTMPItem } from "~/service/model/rtmp";
import { EditForm, type EditFromImpl } from "./edit";
import { useRef, useState } from "react";
import useDebounce from "~/components/util/debounce";
import { XButtonDelete } from "~/components/xui/button";
import { Play } from "~/service/api/channel";
import { ErrorHandle } from "~/service/error";
import PlayBox, { type PlayBoxRef } from "./play";
import { formatDate } from "~/components/util/date";
import { Badge } from "~/components/ui/badge";
import { copy2Clipboard } from "~/components/util/copy";
import { XTable } from "~/components/xui/table";

export default function RTMPView() {
  // =============== 状态定义 ===============
  const [filters, setFilters] = useState({
    page: 1,
    size: 10,
    key: "",
  });
  const [selectedPlayID, setSelectedPlayID] = useState("");

  // refs
  const editFromRef = useRef<EditFromImpl>(null);
  const playRef = useRef<PlayBoxRef>(null);

  // =============== 查询与操作 ===============
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: [findRTMPsKey, filters],
    queryFn: () => FindRTMPs(filters),
  });

  // 播放功能
  const { mutate: playMutate, isPending: playIsPending } = useMutation({
    mutationFn: Play,
    onSuccess(data) {
      playRef.current?.play(data.data.items[0].http_flv ?? "", data.data);
    },
    onError: ErrorHandle,
  });

  // 删除功能
  const { mutate: delMutate, isPending: delIsPending } = useMutation({
    mutationFn: DelRTMP,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [findRTMPsKey],
      });
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
              })
            }
          >
            <Edit className="h-4 w-4 mr-1" />
            编辑
          </Button>

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
            <Copy className="h-4 w-4 mr-1" />
            RTMP
          </Button>

          <XButtonDelete
            onConfirm={() => delMutate(record.id)}
            isLoading={delIsPending}
          />
        </div>
      ),
    },
  ];

  // 搜索防抖
  const debouncedFilters = useDebounce(setFilters, 500);

  return (
    <div className="w-full bg-white p-4 rounded-lg">
      {/* 搜索和添加区域 */}
      <div className="flex justify-end items-center py-4">
        <span className="mr-3">搜索</span>
        <Input
          placeholder="可输入应用名/流 ID 模糊搜索"
          onChange={(event) => {
            debouncedFilters({ ...filters, page: 1, key: event.target.value });
          }}
          className="w-56"
        />

        <EditForm
          ref={editFromRef}
          onAddSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: [findRTMPsKey],
            });
          }}
          onEditSuccess={(updatedItem) => {
            queryClient.setQueryData([findRTMPsKey, filters], (old: any) => ({
              ...old,
              data: {
                ...old.data,
                items: old.data.items.map((item: RTMPItem) =>
                  item.id === updatedItem.id ? updatedItem : item
                ),
              },
            }));
          }}
        />
      </div>

      {/* 使用封装的 XTable 替换 antd Table */}
      <XTable
        columns={columns}
        dataSource={data?.data.items}
        loading={isLoading}
        rowKey="id"
        pagination={{
          current: filters.page,
          pageSize: filters.size,
          total: data?.data.total,
          onChange: (page, size) => {
            setFilters({ ...filters, page, size });
          },
        }}
      />

      {/* 播放器 */}
      <PlayBox ref={playRef} />
    </div>
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
