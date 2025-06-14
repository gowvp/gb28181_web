import React, { useCallback, useRef } from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  ReactFlowProvider,
  MarkerType,
  Handle,
  Position,
} from "@xyflow/react";
import type { Node, Edge, Connection } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { motion } from "framer-motion";
import { MediaServerCard } from "./media";
import { Cctv, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

// 通用节点样式
const commonNodeStyle = {
  border: "none",
  background: "transparent",
  boxShadow: "none",
  width: "auto",
  height: "auto",
  padding: 0,
  margin: 0,
};

const commonNodeClassName = "";

// 通用连接点样式
const handleStyle = { background: "#94a3b8" };

// 通用边样式
const commonEdgeStyle = {
  strokeWidth: 1.5,
  strokeDasharray: "5,5",
  animated: true,
  type: "smoothstep" as const,
  style: {
    strokeWidth: 1.5,
    strokeDasharray: "5,5",
  },
};

// 创建边
const createEdge = (
  id: string,
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle: string,
  color: string
): Edge => ({
  id,
  source,
  target,
  sourceHandle,
  targetHandle,
  ...commonEdgeStyle,
  style: {
    ...commonEdgeStyle.style,
    stroke: color,
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color,
  },
});

// 创建基础节点
const createBaseNode = (
  id: string,
  position: { x: number; y: number },
  label: React.ReactNode
): Node => ({
  id,
  position,
  data: { label },
  style: commonNodeStyle,
  className: commonNodeClassName,
});

// 创建带图标的节点
const createIconNode = (
  id: string,
  position: { x: number; y: number },
  icon: React.ReactNode,
  text: string,
  handles: { type: "source" | "target"; position: Position; id: string }[]
): Node => {
  const handleElements = handles.map((handle) => (
    <Handle
      key={handle.id}
      type={handle.type}
      position={handle.position}
      id={handle.id}
      style={handleStyle}
    />
  ));

  return createBaseNode(
    id,
    position,
    <Card className="shadow-lg border-none bg-white/80 backdrop-blur-sm">
      <CardContent className="p-3 flex items-center gap-2">
        {icon}
        <span className="font-medium text-sm">{text}</span>
        {handleElements}
      </CardContent>
    </Card>
  );
};

// 创建卡片节点
const createCardNode = (
  id: string,
  position: { x: number; y: number },
  title: string,
  subtitle: string,
  handles: { type: "source" | "target"; position: Position; id: string }[]
): Node => {
  const handleElements = handles.map((handle) => (
    <Handle
      key={handle.id}
      type={handle.type}
      position={handle.position}
      id={handle.id}
      style={handleStyle}
    />
  ));

  return createBaseNode(
    id,
    position,
    <Card className="shadow-lg border-none bg-white/80 backdrop-blur-sm">
      <CardHeader className="p-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      {handleElements}
    </Card>
  );
};

const initialNodes: Node[] = [
  createIconNode(
    "gb28181",
    { x: 100, y: 200 },
    <Cctv className="w-4 h-4 text-blue-500" />,
    "GB/T28181",
    [{ type: "source", position: Position.Right, id: "right" }]
  ),
  createIconNode(
    "rtmp",
    { x: 100, y: 30 },
    <Cctv className="w-4 h-4 text-blue-500" />,
    "RTMP 推流",
    [{ type: "source", position: Position.Right, id: "right" }]
  ),
  createIconNode(
    "rtsp",
    { x: 100, y: 80 },
    <Cctv className="w-4 h-4 text-blue-500" />,
    "RTSP 拉流",
    [{ type: "target", position: Position.Right, id: "right" }]
  ),
  {
    id: "zlm",
    position: { x: 400, y: 38 },
    data: {
      label: (
        <div className="shadow-lg rounded-lg backdrop-blur-sm">
          <Handle
            type="target"
            position={Position.Left}
            id="left1"
            style={{ top: 10, background: "#94a3b8" }}
          />
          <Handle
            type="source"
            position={Position.Left}
            id="left2"
            style={{ top: 60, background: "#94a3b8" }}
          />
          <Handle
            type="target"
            position={Position.Left}
            id="left3"
            style={{ top: 110, background: "#94a3b8" }}
          />
          <Handle
            type="target"
            position={Position.Bottom}
            id="bottom"
            style={{ background: "#94a3b8" }}
          />
          <MediaServerCard />
        </div>
      ),
    },
    style: commonNodeStyle,
    className: commonNodeClassName,
  },
  createCardNode("gowvp", { x: 396, y: 255 }, "GoWVP", "Web视频平台", [
    { type: "target", position: Position.Left, id: "left" },
    { type: "source", position: Position.Top, id: "top" },
    { type: "target", position: Position.Right, id: "right" },
  ]),
  createIconNode(
    "web-client",
    { x: 600, y: 255 },
    <User className="w-4 h-4 text-blue-500" />,
    "网页客户端",
    [{ type: "source", position: Position.Left, id: "left" }]
  ),
];

const initialEdges: Edge[] = [
  createEdge("gb28181-zlm", "gb28181", "zlm", "right", "left3", "#3b82f6"),
  createEdge("gb28181-gowvp", "gb28181", "gowvp", "right", "left", "#8b5cf6"),
  createEdge("rtmp-zlm", "rtmp", "zlm", "right", "left1", "#10b981"),
  createEdge("zlm-rtsp", "zlm", "rtsp", "left2", "right", "#10b981"),
  createEdge("gowvp-zlm", "gowvp", "zlm", "top", "bottom", "#f59e0b"),
  createEdge(
    "web-client-gowvp",
    "web-client",
    "gowvp",
    "left",
    "right",
    "#6366f1"
  ),
];

interface NodeData {
  label: string;
  ip?: string;
}

const nodeTypes = {
  zlm: ({ data }: { data: NodeData }) => {
    return (
      <div className="relative">
        <Card className="w-[180px] bg-white/90 shadow-lg">
          <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium">{data.label}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xs text-muted-foreground">{data.ip}</div>
          </CardContent>
        </Card>
        <Handle
          type="source"
          position={Position.Left}
          id="left2"
          style={{ left: 0, top: "40%", background: "#666666" }}
        />
        <Handle
          type="source"
          position={Position.Left}
          id="left3"
          style={{ left: 0, top: "60%", background: "#666666" }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          style={{ bottom: 0, background: "#666666" }}
        />
      </div>
    );
  },
  rtsp: ({ data }: { data: NodeData }) => {
    return (
      <div className="relative">
        <Card className="w-[140px] bg-white/90 shadow-lg">
          <CardHeader className="p-3">
            <CardTitle className="text-xs font-medium">{data.label}</CardTitle>
          </CardHeader>
        </Card>
        <Handle
          type="target"
          position={Position.Right}
          id="right"
          style={{ background: "#666666" }}
        />
      </div>
    );
  },
  rtmp: ({ data }: { data: NodeData }) => {
    return (
      <div className="relative">
        <Card className="w-[140px] bg-white/90 shadow-lg">
          <CardHeader className="p-3">
            <CardTitle className="text-xs font-medium">{data.label}</CardTitle>
          </CardHeader>
        </Card>
        <Handle
          type="target"
          position={Position.Right}
          id="right"
          style={{ background: "#666666" }}
        />
      </div>
    );
  },
  gb28181: ({ data }: { data: NodeData }) => {
    return (
      <div className="relative">
        <Card className="w-[140px] bg-white/90 shadow-lg">
          <CardHeader className="p-3">
            <CardTitle className="text-xs font-medium">{data.label}</CardTitle>
          </CardHeader>
        </Card>
        <Handle
          type="target"
          position={Position.Right}
          id="right"
          style={{ background: "#666666" }}
        />
      </div>
    );
  },
};

export default function Desktop() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const editRef = useRef<any>(null);
  const queryClient = useQueryClient();

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#f8fafc" }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          defaultEdgeOptions={{
            animated: true,
            style: {
              strokeWidth: 1.5,
              strokeDasharray: "5,5",
            },
            type: "smoothstep",
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          }}
          style={{
            background: "#f8fafc",
          }}
          minZoom={0.1}
          maxZoom={4}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          nodeTypes={nodeTypes}
          panOnDrag={false}
          zoomOnScroll={false}
          nodesDraggable={false}
        >
          <Background gap={16} size={1} color="#e2e8f0" />
          <Controls />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
