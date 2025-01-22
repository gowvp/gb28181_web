import { Table as AntTable } from "antd";
import type { TableProps } from "antd";
import React from "react";

interface XTableProps<T> extends TableProps<T> {
  className?: string;
}

// TODO: antd table 组件相比 shadcn/ui 开发效率更高
// 等未来有时间，可以将 xtable 实现替换成 shadcn/ui table
export function XTable<T extends object>({
  className,
  ...props
}: XTableProps<T>) {
  return (
    <AntTable<T>
      {...props}
      className={className}
      //   size="middle"
      pagination={{
        showSizeChanger: true,
        showQuickJumper: false,
        position: ["bottomRight"],
        showTotal: (total) => `共 ${total} 条`,
        ...props.pagination,
        pageSizeOptions: ["10", "20", "30", "50"],
      }}
    />
  );
}
