import type { Node, NodeProps } from "@xyflow/react";
import { Position } from "@xyflow/react";
import { CardHeader, CardTitle } from "~/components/ui/card";
import { BaseNode } from "./base-node";
import { LabeledHandle } from "./labeled-handle";

export type ZlmNodeData = {
  label: string;
  ip?: string;
};

export type ZlmNode = Node<ZlmNodeData>;

export function ZlmNode({ data }: NodeProps<ZlmNode>) {
  return (
    <BaseNode className="w-32">
      <CardHeader className="p-3">
        <CardTitle className="text-sm font-medium">{data.label}</CardTitle>
      </CardHeader>
      <div className="px-3 pb-3">
        <div className="text-xs text-muted-foreground">{data.ip}</div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between p-2 bg-gray-50">
        <LabeledHandle id="x" type="target" position={Position.Left} />
        <LabeledHandle id="y" type="target" position={Position.Left} />
        <LabeledHandle id="out" type="source" position={Position.Right} />
      </div>
    </BaseNode>
  );
}
