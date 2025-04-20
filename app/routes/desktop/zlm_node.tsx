import React, { useEffect, useRef } from "react";
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
import { Settings } from "lucide-react";
import { EditForm } from "./media/edit";
import { findMediaServersKey } from "~/service/api/media/media";
import { useQueryClient } from "@tanstack/react-query";

export type SumNode = Node<{
  value: number;
  rtmp: number;
  rtsp: number;
  rtp: string;
  http: string;
  item: any;
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

  const editRef = useRef<any>(null);
  const queryClient = useQueryClient();

  return (
    <BaseNode className="w-52">
      <div className="absolute top-1 left-1">
        <div className="relative">
          <div
            className={`absolute w-2 h-2 rounded-full ${
              data.item?.status ? "bg-green-500" : "bg-red-500"
            } animate-ping`}
          ></div>
          <div
            className={`w-2 h-2 rounded-full ${
              data.item?.status ? "bg-green-500" : "bg-red-500"
            }`}
          ></div>
        </div>
      </div>
      <div className="absolute top-1 right-1">
        <div className="relative">
          <button
            onClick={() => {
              editRef.current?.edit(data.item);
            }}
            className="bg-black/50 backdrop-blur-sm text-white p-0.5 rounded-full hover:bg-black/70 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
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

      <EditForm
        ref={editRef}
        onEditSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: [findMediaServersKey],
          });
        }}
      />
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
