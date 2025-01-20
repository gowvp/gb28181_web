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
import { Edit, SquarePlay } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FindRTMPs } from "~/service/api/rtmp";
import type { RTMPItem } from "~/service/model/rtmp";
import { AddForm } from "./add";
import { toastError } from "~/components/util/toast";
import { useState } from "react";
import useDebounce from "~/components/util/debounce";
import { XButtonDelete } from "~/components/xui/button";
import { Play } from "~/service/api/channel";
import { ErrorHandle } from "~/service/error";

export default function RTMPView() {
  const columns: ColumnDef<RTMPItem>[] = [
    {
      accessorKey: "name",
      header: "名称",
      cell: ({ row }) => <div>{row.getValue("name")}</div>,
    },
    // {
    //   accessorKey: "id",
    //   header: "设备编号",
    //   cell: ({ row }) => <div>{row.getValue("id")}</div>,
    // },
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
      cell: ({ row }) => <div>{row.getValue("status")}</div>,
    },

    // {
    //   accessorKey: "factory",
    //   header: "信令协议",
    //   cell: () => <div>{"TCP"}</div>,
    // },

    {
      accessorKey: "media_stream_id",
      header: "流媒体",
      cell: ({ row }) => {
        let value: string = row.getValue("media_stream_id") ?? "";
        if (value == "") {
          value = "-";
        }
        return <div>{value}</div>;
      },
    },

    {
      accessorKey: "pushed_at",
      header: "推流时间",
      cell: ({ row }) => {
        let value: string = row.getValue("pushed_at");
        if (value.startsWith("197")) {
          value = "-";
        }
        return <div className="lowercase">{value}</div>;
      },
    },

    {
      id: "actions",
      // enableHiding: false,
      header: "操作",
      cell: ({ row }) => {
        // const FindRTMPsResponse = row.original;
        return (
          <div>
            <Button
              disabled={isPending}
              isLoading={isPending && selectedPlayID == row.original.id}
              onClick={() => {
                setSelectedPlayID(row.original.id);
                mutate(row.original.id);
              }}
              variant="ghost"
              size="sm"
            >
              <SquarePlay className="h-4 w-4" />
              播放
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                toastError({
                  title: "编辑",
                  description: "此功能暂未实现",
                })
              }
            >
              <Edit className="h-4 w-4" />
              编辑
            </Button>
            <XButtonDelete />
          </div>
        );
      },
    },
  ];

  const [filters, setFilters] = useState({
    page: 1,
    size: 10,
    key: "",
  });

  const { data } = useQuery({
    queryKey: ["rtmps", filters],
    queryFn: () => FindRTMPs(filters),
    refetchInterval: 8000,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (id: string) => Play(id),
    onSuccess(data) {
      console.log("🚀 ~ onSuccess ~ data:", data);
    },
    onError: ErrorHandle,
  });

  const [selectedPlayID, setSelectedPlayID] = useState("");

  const debouncedFilters = useDebounce(setFilters, 500);

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

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
    },
  });

  return (
    <div className="w-full bg-white p-4 rounded-lg">
      <div className="flex justify-end items-center py-4">
        <span className="mr-3">搜索</span>
        <Input
          placeholder="可输入应用名/流 ID 模糊搜索"
          onChange={(event) => {
            debouncedFilters({ ...filters, key: event.target.value });
          }}
          className="w-56"
        />

        {/* <span className="mx-3">流媒体</span>
        <Input
          placeholder="Filter emails..."
          value={(table.getColumn("email")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("email")?.setFilterValue(event.target.value)
          }
          className="w-30"
        /> */}

        {/* <span className="mx-3">推流状态</span>
        <Input
          placeholder="Filter emails..."
          value={(table.getColumn("email")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("email")?.setFilterValue(event.target.value)
          }
          className="w-30"
        /> */}

        <AddForm />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
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
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        {/* <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div> */}
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
