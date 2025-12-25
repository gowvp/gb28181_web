import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface TableQueryOptions<_T> {
  queryKey: string;
  fetchFn: (params: any) => Promise<any>;
  deleteFn: (id: string) => Promise<any>;
  defaultFilters?: {
    page: number;
    size: number;
    key?: string;
  };
}

export function useTableQuery<T>({
  queryKey,
  fetchFn,
  deleteFn,
  defaultFilters = { page: 1, size: 10, key: "" },
}: TableQueryOptions<T>) {
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
    onSuccess: (data) => {
      queryClient.setQueryData([queryKey, filters], (old: any) => {
        const newItems = old.data.items.filter(
          (item: any) => item.id !== data.data.id,
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
      setFilters({ ...filters, page: 1 });
      return;
    }
    queryClient.invalidateQueries({
      queryKey: [queryKey],
    });
  };

  // 编辑成功处理
  const handleEditSuccess = (updatedItem: T) => {
    queryClient.setQueryData([queryKey, filters], (old: any) => ({
      ...old,
      data: {
        ...old.data,
        items: old.data.items.map((item: any) =>
          item.id === (updatedItem as any).id ? updatedItem : item,
        ),
      },
    }));
  };

  return {
    data: data?.data,
    isLoading,
    filters,
    setFilters,
    delMutate,
    delIsPending,
    queryClient,
    handleAddSuccess,
    handleEditSuccess,
  };
}
