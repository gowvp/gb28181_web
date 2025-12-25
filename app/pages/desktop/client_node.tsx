import {
  type Node,
  type NodeProps,
  Position,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { useEffect } from "react";

import { BaseNode } from "~/components/base-node";
import { LabeledHandle } from "~/components/labeled-handle";

export type SumNode = Node<{
  value: number;
}>;

export function ClientNode({ id }: NodeProps<SumNode>) {
  const { updateNodeData, getHandleConnections } = useReactFlow();
  const { x, y } = useStore((state) => ({
    x: getHandleValue(
      getHandleConnections({ nodeId: id, id: "x", type: "target" }),
      state.nodeLookup,
    ),
    y: getHandleValue(
      getHandleConnections({ nodeId: id, id: "y", type: "target" }),
      state.nodeLookup,
    ),
  }));

  useEffect(() => {
    updateNodeData(id, { value: x + y });
  }, [x, y, id, updateNodeData]);

  return (
    <BaseNode className="w-32">
      <div className="max-h-10 max-w-10 mb-5 m-auto ">
        <img
          src={"./assets/imgs/chrome.png"}
          alt="直播预览"
          className="object-contain "
        />
      </div>

      <footer className="bg-gray-100 -mx-5 -mb-5">
        <LabeledHandle
          title="网页后台管理"
          type="source"
          position={Position.Left}
        />
      </footer>
    </BaseNode>
  );
}

function getHandleValue(
  connections: Array<{ source: string }>,
  lookup: Map<string, Node<any>>,
) {
  return connections.reduce((acc, { source }) => {
    const node = lookup.get(source)!;
    const value = node.data.value;

    return typeof value === "number" ? acc + value : acc;
  }, 0);
}
