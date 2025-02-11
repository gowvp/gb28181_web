import * as React from "react";
import type { ColumnsType } from "antd/es/table";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Edit, RefreshCcw, SquarePlay } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { EditForm } from "./edit";
import { useRef, useState } from "react";
import useDebounce from "~/components/util/debounce";
import {
  FindChannels,
  findChannelsKey,
  Play,
} from "~/service/api/channel/channel";
import { ErrorHandle } from "~/service/error";
import { Badge } from "~/components/ui/badge";
import type { EditSheetImpl } from "~/components/xui/edit-sheet";
import { TableQuery, type TableQueryRef } from "~/components/xui/table-query";
import type { ChannelItem } from "~/service/api/channel/channel.d";
import PlayBox, { type PlayBoxRef } from "~/components/xui/play";
import { toastSuccess, toastWarn } from "~/components/xui/toast";
import { RefreshCatalog } from "~/service/api/device/device";
import { cn } from "~/lib/utils";
import XHeader from "~/components/xui/header";

export default function RTMPView() {
  // =============== 状态定义 ===============
  const [selectedPlayID, setSelectedPlayID] = useState("");

  // refs
  const editFromRef = useRef<EditSheetImpl>(null);
  const playRef = useRef<PlayBoxRef>(null);
  const tableRef = useRef<TableQueryRef<ChannelItem>>(null);

  const params = new URLSearchParams(window.location.search);
  const device_id = params.get("device_id");

  // =============== 查询与操作 ===============

  // 播放功能
  const { mutate: playMutate, isPending: playIsPending } = useMutation({
    mutationFn: Play,
    onSuccess(data) {
      playRef.current?.play(data.data.items[0].http_flv ?? "", data.data);
    },
    onError: (error) => {
      setSelectedPlayID("");
      ErrorHandle(error);
    },
  });

  // =============== 表格列定义 ===============
  const columns: ColumnsType<ChannelItem> = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "编号",
      dataIndex: "channel_id",
      key: "channel_id",
    },
    {
      title: "快照",
      dataIndex: "snapshot",
      key: "snapshot",
    },
    {
      title: "厂家",
      dataIndex: ["ext", "manufacturer"],
      key: "ext.manufacturer",
    },

    {
      title: "云台类型",
      dataIndex: "ptztype",
      key: "ptztype",
    },

    // {
    //   title: "流 ID",
    //   dataIndex: "stream",
    //   key: "stream",
    // },
    // {
    //   title: "推流状态",
    //   dataIndex: "status",
    //   key: "status",
    //   render: (value: string) => {
    //     let color = "";
    //     let text = "";
    //     if (value == "STOPPED") {
    //       color = "bg-orange-300";
    //       text = "NO";
    //     } else if (value == "PUSHING") {
    //       color = "bg-green-300";
    //       text = "OK";
    //     }

    //     return text ? (
    //       <Badge variant="secondary" className={`${color} text-white`}>
    //         {text}
    //       </Badge>
    //     ) : (
    //       <span></span>
    //     );
    //   },
    // },
    // {
    //   title: "流媒体",
    //   dataIndex: "media_server_id",
    //   key: "media_server_id",
    //   render: (value: string) => value || "-",
    // },
    // {
    //   title: "推流时间",
    //   dataIndex: "pushed_at",
    //   key: "pushed_at",
    //   render: (pushed_at: string, record: RTMPItem) => {
    //     const color = pushed_at < record.stopped_at ? "text-gray-400" : "";
    //     return <div className={color}>{formatDate(pushed_at)}</div>;
    //   },
    // },
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
      render: (_, record) => (
        <div className="flex gap-0">
          <Button
            // disabled={playIsPending}
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

          {/* <Button
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
          </Button> */}
        </div>
      ),
    },
  ];

  // 搜索防抖
  const debouncedFilters = useDebounce((key: string) => {
    tableRef.current?.setFilters((prev: any) => ({ ...prev, page: 1, key }));
  }, 500);

  const { mutate: refreshCatalogMutate, isPending: refreshCatalogIsPending } =
    useMutation({
      mutationFn: RefreshCatalog,
      onSuccess: () => {
        toastSuccess("刷新成功");
        tableRef.current?.setFilters((prev: any) => ({ ...prev, page: 1 }));
      },
      onError: ErrorHandle,
    });

  return (
    <>
      <XHeader
        items={[{ title: "国标设备", url: "devices" }, { title: "通道列表" }]}
      />
      <div className="w-full bg-white p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <Button
            // variant="ghost"
            size="sm"
            onClick={() => {
              if (device_id) refreshCatalogMutate(device_id);
            }}
            disabled={refreshCatalogIsPending}
          >
            <RefreshCcw
              className={cn(
                "h-4 w-4 mr-1",
                refreshCatalogIsPending && "animate-spin"
              )}
            />
            向设备同步通道
          </Button>

          {/* 搜索和添加区域 */}
          <div className="flex justify-end items-center py-4">
            <span className="mr-3">搜索</span>
            <Input
              placeholder="可输入名称/国标ID/id 模糊搜索"
              onChange={(event) => debouncedFilters(event.target.value)}
              className="w-56"
            />

            {/* <EditForm
            ref={editFromRef}
            onAddSuccess={() => tableRef.current?.handleAddSuccess()}
            onEditSuccess={(data) => tableRef.current?.handleEditSuccess(data)}
          /> */}
          </div>
        </div>

        <TableQuery
          ref={tableRef}
          queryKey={findChannelsKey}
          fetchFn={FindChannels}
          columns={columns}
          defaultFilters={{ page: 1, size: 10, device_id: device_id ?? "" }}
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
