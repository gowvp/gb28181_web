import React from "react";
import { Button } from "../ui/button";
import { cn } from "~/lib/utils";

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
    <>
      <Button className={cn(className)}>
        {children ?? (
          <>
            {icon} {title}
          </>
        )}
      </Button>
    </>
  );
}
