import React, { useEffect } from "react";
import {
  type Node,
  type NodeProps,
  Position,
  useReactFlow,
  useStore,
} from "@xyflow/react";

import { BaseNode } from "~/components/base-node";
import { LabeledHandle } from "~/components/labeled-handle";
import { NodeHeader, NodeHeaderTitle } from "~/components/node-header";

export type SumNode = Node<{
  value: number;
  rtmp: number;
  rtsp: number;
  rtp: string;
  http: string;
}>;

export function ZLMNode({ id, data }: NodeProps<SumNode>) {
  const { updateNodeData, getHandleConnections } = useReactFlow();
  const { x, y } = useStore((state) => ({
    x: getHandleValue(
      getHandleConnections({ nodeId: id, id: "x", type: "target" }),
      state.nodeLookup
    ),
    y: getHandleValue(
      getHandleConnections({ nodeId: id, id: "y", type: "target" }),
      state.nodeLookup
    ),
    z: getHandleValue(
      getHandleConnections({ nodeId: id, id: "z", type: "target" }),
      state.nodeLookup
    ),

  }));

  useEffect(() => {
    updateNodeData(id, { value: x + y });
  }, [x, y]);

  return (
    <BaseNode className="w-52">
      <img
        src={"./assets/imgs/zlm.webp"}
        alt="直播预览"
        className=" object-contain "
      />

      <footer className="bg-gray-100 -mx-5 -mb-5">
        <LabeledHandle
          title={`rtmp ${data.rtmp}`}
          id="x"
          type="target"
          position={Position.Left}
        />
        <LabeledHandle
          title={`rtsp ${data.rtsp}`}
          id="y"
          type="target"
          position={Position.Left}
        />

        <LabeledHandle
          title={`RTP ${data.rtp}`}
          id="z"
          type="target"
          position={Position.Left}
        />

        <LabeledHandle
          title={`HTTP ${data.http}`}
          type="source"
          position={Position.Left}
        />

        {/* <LabeledHandle title="out" type="source" position={Position.Right} /> */}
      </footer>
    </BaseNode>
  );
}

function getHandleValue(
  connections: Array<{ source: string }>,
  lookup: Map<string, Node<any>>
) {
  return connections.reduce((acc, { source }) => {
    const node = lookup.get(source)!;
    const value = node.data.value;

    return typeof value === "number" ? acc + value : acc;
  }, 0);
}
