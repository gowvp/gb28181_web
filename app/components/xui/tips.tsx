import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

export default function ToolTips({
  children,
  tips,
  disabled,
}: {
  children: React.ReactNode;
  tips: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>{tips}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
