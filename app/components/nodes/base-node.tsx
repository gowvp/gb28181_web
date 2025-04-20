import React from "react";
import { Card, CardContent } from "~/components/ui/card";

interface BaseNodeProps {
  children: React.ReactNode;
  className?: string;
}

export function BaseNode({ children, className }: BaseNodeProps) {
  return (
    <Card className={`bg-white/90 shadow-lg ${className}`}>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}
