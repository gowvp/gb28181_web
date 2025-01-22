import * as React from "react";
import {
  type ColumnDef,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Input } from "~/components/ui/input";
import { Copy, Edit, SquarePlay } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DelRTMP, FindRTMPs, findRTMPsKey } from "~/service/api/rtmp";
import type { RTMPItem } from "~/service/model/rtmp";
import { EditForm, type EditFromImpl } from "./edit";
import { useEffect, useRef, useState } from "react";
import useDebounce from "~/components/util/debounce";
import { XButtonDelete } from "~/components/xui/button";
import { Play } from "~/service/api/channel";
import { ErrorHandle } from "~/service/error";
import PlayBox, { type PlayBoxRef } from "./play";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { formatDate } from "~/components/util/date";
import { Badge } from "~/components/ui/badge";
import { copy2Clipboard } from "~/components/util/copy";
import PaginationBox from "~/components/xui/pagination";

export default function RTMPView() {
  // =============== 状态定义 ===============
  const [filters, setFilters] = useState({
    page: 1,
    size: 12,
    key: "",
  });
  const [selectedPlayID, setSelectedPlayID] = useState("");
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [deletedId, setDeletedId] = useState<string | null>(null);

  // refs
  const editFromRef = useRef<EditFromImpl>(null);
  const playRef = useRef<PlayBoxRef>(null);
  // 控制新增动画的标记
  const showAddAnimation = useRef(false);

  // =============== 查询与操作 ===============
  const queryClient = useQueryClient();

  // 查询列表数据
  const { data } = useQuery({
    queryKey: [findRTMPsKey, filters],
    queryFn: () => FindRTMPs(filters),
    // refetchInterval: 3000,
  });
  useEffect(() => {
    console.log("🚀 ~ useEffect ~ useEffect:", useEffect);
    return () => {};
  }, [data]);

  // 播放功能
  const { mutate: playMutate, isPending: playIsPending } = useMutation({
    mutationFn: Play,
    onSuccess(data) {
      playRef.current?.play(data.data.items[0].http_flv ?? "", data.data);
    },
    onError: ErrorHandle,
  });

  // 删除功能（使用乐观更新）
  const { mutate: delMutate, isPending: delIsPending } = useMutation({
    mutationFn: DelRTMP,
    onMutate: async (deletedItemId) => {
      setDeletedId(deletedItemId);
      await queryClient.cancelQueries({ queryKey: [findRTMPsKey] });
      const previousData = queryClient.getQueryData([findRTMPsKey, filters]);

      queryClient.setQueryData([findRTMPsKey, filters], (old: any) => ({
        ...old,
        data: {
          ...old.data,
          items: old.data.items.filter(
            (item: RTMPItem) => item.id !== deletedItemId
          ),
        },
      }));

      return { previousData };
    },
    onError: (err, _, context) => {
      // 发生错误时恢复数据
      queryClient.setQueryData([findRTMPsKey, filters], context?.previousData);
      ErrorHandle(err);
    },
    onSuccess: () => {
      // 静默刷新数据
      queryClient.invalidateQueries({
        queryKey: [findRTMPsKey],
        exact: false,
        refetchType: "none",
      });
    },
  });

  // =============== 表格列定义 ===============
  const columns: ColumnDef<RTMPItem>[] = [
    {
      accessorKey: "name",
      header: "名称",
      cell: ({ row }) => <div>{row.getValue("name")}</div>,
    },
    {
      accessorKey: "app",
      header: "应用名",
      cell: ({ row }) => <div>{row.getValue("app")}</div>,
    },
    {
      accessorKey: "stream",
      header: "流 ID",
      cell: ({ row }) => <div>{row.getValue("stream")}</div>,
    },
    {
      accessorKey: "status",
      header: "推流状态",
      cell: ({ row }) => {
        const value: string = row.getValue("status");

        let color = "";
        let text = "";
        if (value == "STOPPED") {
          color = "bg-orange-300";
          text = "NO";
        } else if (value == "PUSHING") {
          color = "bg-green-300";
          text = "OK";
        }

        if (text == "") {
          return <span></span>;
        }

        return (
          <Badge variant="secondary" className={`${color} text-white`}>
            {text}
          </Badge>
        );
      },
    },
    {
      accessorKey: "media_server_id",
      header: "流媒体",
      cell: ({ row }) => {
        const value: string = row.getValue("media_server_id") ?? "";
        return <div>{value || "-"}</div>;
      },
    },
    {
      accessorKey: "pushed_at",
      header: "推流时间",
      cell: ({ row }) => {
        const v1: string = row.getValue("pushed_at");
        const v2: string = row.getValue("stopped_at");

        const color = v1 < v2 ? "text-gray-400" : "";
        return <div className={color}>{formatDate(v1)}</div>;
      },
    },
    {
      accessorKey: "stopped_at",
      header: "停流时间",
      cell: ({ row }) => {
        const v1: string = row.getValue("pushed_at");
        const v2: string = row.getValue("stopped_at");

        const color = v1 > v2 ? "text-gray-400" : "";
        return <div className={`${color}`}>{formatDate(v2)}</div>;
      },
    },

    {
      id: "actions",
      header: "操作",
      cell: ({ row }) => (
        <div className="flex gap-0">
          <Button
            disabled={playIsPending}
            isLoading={playIsPending && selectedPlayID === row.original.id}
            onClick={() => {
              setSelectedPlayID(row.original.id);
              playMutate(row.original.id);
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
                id: row.original.id,
                app: row.original.app,
                stream: row.original.stream,
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
              const value = row.original.push_addrs[0];
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
            onConfirm={() => delMutate(row.original.id)}
            isLoading={delIsPending}
          />
        </div>
      ),
    },
  ];

  // =============== 表格配置 ===============
  const table = useReactTable({
    data: data?.data.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      columnVisibility,
      rowSelection,
      pagination: {
        pageIndex: 0,
        pageSize: filters.size,
      },
    },
  });

  // 搜索防抖
  const debouncedFilters = useDebounce(setFilters, 500);

  // =============== 渲染部分 ===============
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
            // 新增成功后设置动画标记
            showAddAnimation.current = true;
          }}
          onEditSuccess={(data) => {
            const value = data as RTMPItem;
            queryClient.setQueryData([findRTMPsKey, filters], (old: any) => ({
              ...old,
              data: {
                ...old.data,
                items: old.data.items.map((item: RTMPItem) =>
                  item.id === value.id ? value : item
                ),
              },
            }));
          }}
        />
      </div>

      {/* 表格区域 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="sync" initial={false}>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <motion.tr
                    key={row.original.id}
                    initial={
                      showAddAnimation.current &&
                      row === table.getRowModel().rows[0]
                        ? { opacity: 0, y: -20 }
                        : { opacity: 1, y: 0 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={
                      deletedId === row.original.id
                        ? { opacity: 0, y: -20 }
                        : { opacity: 1, y: 0 }
                    }
                    transition={{
                      duration: 0.2,
                      ease: "easeOut",
                    }}
                    onAnimationComplete={() => {
                      // 动画完成后重置标记
                      showAddAnimation.current = false;
                      setDeletedId(null);
                    }}
                    className={cn(
                      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
                      row.getIsSelected() && "selected"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </motion.tr>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {/* 分页区域 */}
      <PaginationBox
        page={filters.page}
        size={filters.size}
        total={data?.data.total ?? 0}
        setPagination={(page, size) => {
          console.log(
            "🚀 ~ RTMPView ~ page/size:",
            page,
            size,
            data?.data.total ?? 0
          );
          setFilters({ ...filters, page, size });
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
