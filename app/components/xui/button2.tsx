import type React from "react";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";

export default function XButton({
  children,
  title,
  icon,
  className,
}: {
  children?: React.ReactNode;
  title: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <Button className={cn(className)}>
      {children ?? (
        <>
          {icon} {title}
        </>
      )}
    </Button>
  );
}
