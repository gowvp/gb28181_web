import "@xyflow/react/dist/style.css";

import {
  ReactFlow,
  type OnConnect,
  useNodesState,
  useEdgesState,
  addEdge,
  type Edge,
  type Node,
} from "@xyflow/react";

import { DataEdge } from "~/components/data-edge";
import { useCallback, useEffect } from "react";
import { NumNode } from "./num_node";
import { ZLMNode } from "./zlm_node";
import { GoWVPNode } from "./wvp_node";
import { ClientNode } from "./client_node";
import { useQuery } from "@tanstack/react-query";
import {
  FindMediaServers,
  findMediaServersKey,
} from "~/service/api/media/media";
import { ErrorHandle } from "~/service/error";

const nodeTypes = {
  ipc: NumNode,
  zlm: ZLMNode,
  gowvp: GoWVPNode,
  client: ClientNode,
};

const edgeTypes = {
  data: DataEdge,
};

const initialNodes: Node[] = [
  {
    id: "rtmp",
    type: "ipc",
    data: { name: "RTMP 推流", value: 0, path: "/rtmps" },
    position: { x: 0, y: 0 },
  },
  {
    id: "rtsp",
    type: "ipc",
    data: { name: "RTSP 拉流", value: 0, path: "/rtsps" },
    position: { x: 0, y: 200 },
  },
  {
    id: "zlm",
    type: "zlm",
    data: {
      name: "zlm",
      value: 0,
    },
    position: { x: 300, y: 0 },
  },
  {
    id: "gb28181",
    type: "ipc",
    data: { name: "GB/T28181", value: 0, path: "/nchannels" },
    position: { x: 0, y: 400 },
  },
  {
    id: "gowvp",
    type: "gowvp",
    data: {
      name: "GOWVP",
      value: 0,
    },
    position: { x: 300, y: 280 },
  },

  {
    id: "client",
    type: "client",
    data: {
      name: "client",
      value: 0,
    },
    position: { x: 600, y: 200 },
  },
];

const initialEdges: Edge[] = [
  {
    id: "rtmp->zlm",
    type: "data",
    data: { key: "value" },
    source: "rtmp",
    target: "zlm",
    targetHandle: "x",
    animated: true,
  },
  {
    id: "rtsp->zlm",
    type: "data",
    data: { key: "value" },
    source: "rtsp",
    target: "zlm",
    targetHandle: "y",
    animated: true,
  },
  {
    id: "gb28181->zlm",
    type: "data",
    data: { key: "value" },
    source: "gb28181",
    target: "zlm",
    targetHandle: "z",
    animated: true,
  },
  {
    id: "gowvp->zlm",
    type: "data",
    data: { key: "value" },
    source: "zlm",
    target: "gowvp",
    targetHandle: "x",
    animated: true,
  },

  {
    id: "gb28181->gowvp",
    type: "data",
    data: { key: "value" },
    source: "gb28181",
    target: "gowvp",
    targetHandle: "y",
    animated: true,
  },

  {
    id: "client->gowvp",
    type: "data",
    data: { key: "value" },
    source: "client",
    target: "gowvp",
    targetHandle: "z",
    animated: true,
  },
];

export default function DesktopView() {
  const { data, isLoading } = useQuery({
    queryKey: [findMediaServersKey],
    queryFn: () => FindMediaServers(),
    throwOnError: (error) => {
      ErrorHandle(error);
      return true;
    },
  });

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    if (data?.data.items[0]) {
      const item = data.data.items[0];
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === "zlm") {
            return {
              ...node,
              data: {
                ...node.data,
                rtmp: item.ports?.rtmp,
                rtsp: item.ports?.rtsp,
                rtp: item.sdp_ip + ":" + item.rtpport_range + "(UDP/TCP)",
                http: item.ip + ":" + item.ports?.http,
              },
            };
          }
          return node;
        })
      );
    }
  }, [data, setNodes]);

  const onConnect: OnConnect = useCallback(
    (params: any) => {
      setEdges((edges) =>
        addEdge({ type: "data", data: { key: "value" }, ...params }, edges)
      );
    },
    [setEdges]
  );

  return (
    <div className="h-screen w-screen p-8">
      <style>
        {`
          .react-flow__attribution {
            display: none !important;
          }
        `}
      </style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      />
    </div>
  );
}
