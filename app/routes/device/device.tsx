import * as React from "react";
import type { ColumnsType } from "antd/es/table";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Edit, Filter, Folder, RefreshCcw } from "lucide-react";
import { useRef, useState } from "react";
import useDebounce from "~/components/util/debounce";
import { XButtonDelete } from "~/components/xui/button";
import { formatDate } from "~/components/util/date";
import type { EditSheetImpl } from "~/components/xui/edit-sheet";
import { TableQuery, type TableQueryRef } from "~/components/xui/table-query";
import { EditForm } from "./edit";
import type { DeviceItem } from "~/service/api/device/state";
import {
  DelDevice,
  FindDevices,
  findDevicesKey,
} from "~/service/api/device/device";
import { toastWarn } from "~/components/xui/toast";
import { Badge } from "~/components/ui/badge";
import { Link, useNavigate } from "react-router";
import XHeader from "~/components/xui/header";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { cn } from "~/lib/utils";

export default function DeviceView() {
  const navigate = useNavigate();
  // refs
  const editFromRef = useRef<EditSheetImpl>(null);
  const tableRef = useRef<TableQueryRef<DeviceItem>>(null);

  // =============== 表格列定义 ===============
  const columns: ColumnsType<DeviceItem> = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      minWidth: 100,
      render(value, record) {
        let name = record.name;
        // 用户未自定义名称，采用设备上报名称
        if (name.length <= 0) {
          name = record.ext.name;
        }
        return <div>{name}</div>;
      },
    },
    {
      title: "设备编号",
      dataIndex: "device_id",
      key: "device_id",
      minWidth: 180,
    },
    {
      title: "地址",
      dataIndex: "address",
      key: "address",
      minWidth: 180,
      render(value, record) {
        return (
          <span className="lowercase">{`${record.trasnport}://${record.address}`}</span>
        );
      },
    },
    {
      title: "厂家",
      dataIndex: "manufacturer",
      key: "manufacturer",
      render(value, record) {
        return record.ext.manufacturer;
      },
      minWidth: 100,
    },
    {
      title: "流传输模式",
      dataIndex: "stream_mode",
      key: "stream_mode",
      render(value, record) {
        return record.stream_mode === 0
          ? "UDP"
          : record.stream_mode === 1
          ? "TCP Passive"
          : "TCP Active";
      },
    },
    {
      title: "通道数",
      dataIndex: "channels",
      key: "channels",
      minWidth: 80,
    },
    {
      title: "状态",
      dataIndex: "is_online",
      align: "center",
      key: "is_online",
      render(value, record) {
        return (
          <Badge
            variant="secondary"
            className={`${
              record.is_online ? "bg-green-300" : "bg-orange-300"
            } text-white`}
          >
            {record.is_online ? "在线" : "离线"}
          </Badge>
        );
      },
      minWidth: 80,
    },
    {
      title: "订阅",
      minWidth: 80,
    },

    {
      title: "最近心跳",
      dataIndex: "keepalive_at",
      key: "keepalive_at",
      render: (pushed_at: string) => {
        return <div>{formatDate(pushed_at)}</div>;
      },
    },

    {
      title: "最近注册",
      dataIndex: "registered_at",
      key: "registered_at",
      render: (pushed_at: string) => {
        return <div>{formatDate(pushed_at)}</div>;
      },
    },

    {
      title: "操作",
      key: "action",
      fixed: "right",
      render: (_, record: DeviceItem) => (
        <div className="flex gap-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigate(`/channels?device_id=${record.device_id}`);
            }}
          >
            <Folder className="h-4 w-4 mr-1" />
            通道
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
    tableRef.current?.setFilters((prev: any) => ({
      ...prev,
      page: 1,
      key,
    }));
  }, 500);

  const [isShowFilter, setIsShowFilter] = useState(true);

  return (
    <>
      <div className="w-full bg-white p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Link to="/nchannels">
              <Button variant="outline">客户端</Button>
            </Link>
            <Link to="/gb/sip">
              <Button variant="outline">接入信息</Button>
            </Link>
          </div>

          {/* 搜索和添加区域 */}
          <div className="flex justify-end items-center py-4">
            <span className="mr-3">搜索</span>
            <Input
              placeholder="可输入设备编号/名称/ID模糊搜索"
              onChange={(event) => debouncedFilters(event.target.value)}
              className="w-60"
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

        <TableQuery
          ref={tableRef}
          queryKey={findDevicesKey}
          fetchFn={FindDevices}
          deleteFn={DelDevice}
          columns={columns}
        />
      </div>
    </>
  );
}
