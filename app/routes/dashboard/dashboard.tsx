import React from "react";
import { CPUBox } from "./cpu";
import CountBox from "./count";
import { NetworkBox } from "./network";
import { MemoryBox } from "./memory";
import { DiskBox } from "./disk";
import { LoadBox } from "./load";
import { useQuery } from "@tanstack/react-query";
import { FindStats } from "~/service/api/stat";
import { ErrorHandle } from "~/service/http";

export default function DashboardView() {
  // 使用 react-query 固定间隔获取一次服务端状态信息
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: FindStats,
    refetchInterval: 5000,
    throwOnError: (error, query) => {
      return false;
    },
  });

  return (
    <div className="flex flex-col h-full ml-1">
      <div className="flex flex-1">
        {[
          // cpu 面积图
          <CPUBox data={query.data?.data.cpu ?? []} />,
          // 设备统计饼图
          <CountBox />,
          // 网络 IO 折线图
          <NetworkBox data={query.data?.data.net ?? []} />,
        ].map((item, index) => (
          <Cardbox key={index} className="bg-blue-200">
            {item}
          </Cardbox>
        ))}
      </div>
      <div className="flex flex-1">
        {[
          // 内存使用面积图
          <MemoryBox data={query.data?.data.mem ?? []} />,
          // 流负载信息柱状图
          <LoadBox />,
          // 磁盘使用条形图
          <DiskBox data={query.data?.data.disk ?? []} />,
        ].map((item, index) => (
          <Cardbox key={index} className="bg-blue-200">
            {item}
          </Cardbox>
        ))}
      </div>
    </div>
  );
}

export function Cardbox({
  className,
  children,
  ...props
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`flex-1 mb-2 mr-2 rounded-[20px] ${className}`}>
      {children}
    </div>
  );
}
