import React from "react";
import { Handle, Position } from "@xyflow/react";

interface LabeledHandleProps {
  id: string;
  type: "source" | "target";
  position: Position;
  title?: string;
}

export function LabeledHandle({
  id,
  type,
  position,
  title,
}: LabeledHandleProps) {
  return (
    <div className="relative">
      <Handle
        id={id}
        type={type}
        position={position}
        style={{ background: "#666666" }}
      />
    </div>
  );
}
