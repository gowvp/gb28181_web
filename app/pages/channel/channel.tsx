import { useMutation } from "@tanstack/react-query";
import { Radio } from "antd";
import type { ColumnsType } from "antd/es/table";
import { RefreshCcw, SquarePlay } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import useDebounce from "~/components/util/debounce";
import { TableQuery, type TableQueryRef } from "~/components/xui/table-query";
import { toastSuccess } from "~/components/xui/toast";
import { cn } from "~/lib/utils";
import ChannelDetailView from "~/pages/channels/detail";
import {
  FindChannels,
  findChannelsKey,
  type RecordMode,
  SetRecordMode,
} from "~/service/api/channel/channel";
import type { ChannelItem } from "~/service/api/channel/state";
import { RefreshCatalog } from "~/service/api/device/device";
import { ErrorHandle } from "~/service/config/error";

/**
 * 录像模式 RadioButton - 独立组件避免整表重渲染
 */
function RecordModeRadio({ record }: { record: ChannelItem }) {
  const { t } = useTranslation("common");
  const currentMode = record.ext?.record_mode || "none";
  const [mode, setMode] = useState<RecordMode>(currentMode);

  const { mutate, isPending } = useMutation({
    mutationFn: (newMode: RecordMode) => SetRecordMode(record.id, newMode),
    onSuccess: (data) => {
      setMode(data.data.record_mode);
      toast.success(t("record_mode_set_success"));
    },
    onError: ErrorHandle,
  });

  return (
    <Radio.Group
      size="small"
      value={mode}
      onChange={(e) => mutate(e.target.value)}
      disabled={isPending}
      optionType="button"
      buttonStyle="solid"
      options={[
        { label: t("record_short_always"), value: "always" },
        { label: t("record_short_ai"), value: "ai" },
        { label: t("record_short_none"), value: "none" },
      ]}
    />
  );
}

export default function ChannelsView() {
  // =============== 状态定义 ===============
  const { t } = useTranslation("common");

  // refs
  // const editFromRef = useRef<EditSheetImpl>(null);
  const detailRef = useRef<any>(null);
  const tableRef = useRef<TableQueryRef<ChannelItem>>(null);

  const params = new URLSearchParams(window.location.search);
  const did = params.get("did");

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
      title: t("record_mode"),
      key: "record_mode",
      width: 140,
      render: (_, record) => <RecordModeRadio record={record} />,
    },
    {
      title: t("action"),
      key: "action",
      render: (_, record) => (
        <div className="flex gap-0">
          <Button
            onClick={() => {
              detailRef.current?.open({
                id: record.id,
                did: record.did,
                device_id: record.device_id,
                channel_id: record.channel_id,
                name: record.name,
                ptztype: record.ptztype,
                is_online: record.is_online,
                is_playing: false,
                type: record.type,
                ext: record.ext,
                created_at: "",
                updated_at: "",
              });
            }}
            variant="ghost"
            size="sm"
          >
            <SquarePlay className="h-4 w-4 mr-1" />
            {t("play")}
          </Button>
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
      {/* <XHeader
        items={[{ title: "国标设备", url: "devices" }, { title: "通道列表" }]}
      /> */}
      <div className="w-full bg-white p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <Button
            // variant="ghost"
            size="sm"
            onClick={() => {
              if (did) refreshCatalogMutate(did);
            }}
            disabled={refreshCatalogIsPending}
          >
            <RefreshCcw
              className={cn(
                "h-4 w-4 mr-1",
                refreshCatalogIsPending && "animate-spin",
              )}
            />
            向设备同步通道
          </Button>

          {/* 搜索和添加区域 */}
          <div className="flex justify-end items-center py-4">
            <span className="mr-3">搜索</span>
            <Input
              placeholder="可输入名称/国标ID/ID 模糊搜索"
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
          defaultFilters={{ page: 1, size: 10, did: did ?? "" }}
        />

        {/* 播放器 */}
        <ChannelDetailView ref={detailRef} />
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
