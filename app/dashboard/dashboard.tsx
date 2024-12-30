import React from "react";
import { CPUBox } from "./cpu";
import CountBox from "./count";
import { NetworkBox } from "./network";
import { MemoryBox } from "./memory";
import { DiskBox } from "./disk";
import { LoadBox } from "./load";
import { useQuery } from "@tanstack/react-query";
import { FindStats } from "~/service/api/state";
import { ErrorHandle } from "~/service/http";

export default function DashboardView() {
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
          <CPUBox data={query.data?.data.cpu ?? []} />,
          <CountBox />,
          <NetworkBox data={query.data?.data.net ?? []} />,
        ].map((item, index) => (
          <Cardbox key={index} className="bg-blue-200">
            {item}
          </Cardbox>
        ))}
      </div>
      <div className="flex flex-1">
        {[
          <MemoryBox data={query.data?.data.mem ?? []} />,
          <LoadBox />,
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
