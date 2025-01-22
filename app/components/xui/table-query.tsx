import React from "react";
import { useState, useImperativeHandle, forwardRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { XTable } from "./table";
import type { ColumnsType } from "antd/es/table";
import { ErrorHandle } from "~/service/error";

interface TableQueryProps<T> {
  queryKey: string; // 查询key
  fetchFn: (params: any) => Promise<any>; // 查询函数
  deleteFn?: (id: string) => Promise<any>; // 删除函数
  columns: ColumnsType<T>; // 列配置
  // 过滤条件/分页
  defaultFilters?: {
    page: number;
    size: number;
  };
}

export interface TableQueryRef<T> {
  setFilters: (filters: any) => void; // 设置过滤条件
  handleAddSuccess: () => void; // 添加成功处理
  handleEditSuccess: (item: T) => void; // 编辑成功处理
  delMutate: (id: string) => void; // 删除
  delIsPending: boolean; // 删除状态
}

export const TableQuery = forwardRef<TableQueryRef<any>, TableQueryProps<any>>(
  function TableQuery(
    {
      queryKey,
      fetchFn,
      deleteFn,
      columns,
      defaultFilters = { page: 1, size: 10, key: "" },
    },
    ref
  ) {
    const [filters, setFilters] = useState(defaultFilters);
    const queryClient = useQueryClient();

    // 查询数据
    const { data, isLoading } = useQuery({
      queryKey: [queryKey, filters],
      queryFn: () => fetchFn(filters),
    });

    // 删除功能
    const { mutate: delMutate, isPending: delIsPending } = useMutation({
      mutationFn: deleteFn,
      onError: ErrorHandle,
      onSuccess: (data) => {
        queryClient.setQueryData([queryKey, filters], (old: any) => {
          const newItems = old.data.items.filter(
            (item: any) => item.id !== data.data.id
          );

          // 如果当前页数据为空且不是第一页,回退一页
          if (newItems.length === 0 && filters.page > 1) {
            setTimeout(() => {
              setFilters((prev) => ({ ...prev, page: prev.page - 1 }));
            }, 370);
          }
          // 如果是第一页且数据为空,刷新当前页
          else if (newItems.length === 0 && filters.page === 1) {
            setTimeout(() => {
              queryClient.invalidateQueries({
                queryKey: [queryKey, filters],
              });
            }, 370);
          }

          return {
            ...old,
            data: {
              ...old.data,
              items: newItems,
            },
          };
        });
      },
    });

    // 添加成功处理
    const handleAddSuccess = () => {
      if (filters.page !== 1) {
        setFilters({ page: 1, size: filters.size });
        return;
      }
      queryClient.invalidateQueries({
        queryKey: [queryKey],
      });
    };

    // 编辑成功处理
    const handleEditSuccess = (updatedItem: any) => {
      queryClient.setQueryData([queryKey, filters], (old: any) => ({
        ...old,
        data: {
          ...old.data,
          items: old.data.items.map((item: any) =>
            item.id === updatedItem.id ? updatedItem : item
          ),
        },
      }));
    };

    // 暴露内部方法
    useImperativeHandle(ref, () => ({
      setFilters,
      handleAddSuccess,
      handleEditSuccess,
      delMutate,
      delIsPending,
    }));

    return (
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
    );
  }
);
