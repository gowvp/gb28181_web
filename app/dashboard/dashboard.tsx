import React from "react";
import { CPUBox } from "./cpu";
import CountBox from "./count";
import { NetworkBox } from "./network";
import { MemoryBox } from "./memory";
import { DiskBox } from "./disk";
import { LoadBox } from "./load";

export default function DashboardView() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1">
        {[<CPUBox />, <CountBox />, <NetworkBox />].map((item, index) => (
          <Cardbox key={index} className="bg-blue-200">
            {item}
          </Cardbox>
        ))}
      </div>
      <div className="flex flex-1">
        {[<MemoryBox />, <LoadBox />, <DiskBox />].map((item, index) => (
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
    <div className={`flex-1 m-1 rounded-[20px] ${className}`}>{children}</div>
  );
}
