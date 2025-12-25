import type { Edge, Node } from "@xyflow/react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Tooltip } from "antd";
import { Cctv, Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FindMediaServers,
  findMediaServersKey,
} from "~/service/api/media/media";
import { ErrorHandle } from "~/service/config/error";
import { EditForm } from "./media/edit";

// 简单的节点组件
const SimpleNode = ({ data }: { data: any }) => {
  const navigate = useNavigate();
  const { t } = useTranslation("desktop");

  const handleClick = useCallback(() => {
    if (data.path) {
      navigate({ to: data.path });
    }
  }, [data.path, navigate]);

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 min-w-[120px] cursor-pointer hover:shadow-md transition-shadow relative"
      onClick={handleClick}
    >
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ background: "#1890ff", width: 8, height: 8 }}
      />
      <div className="flex items-center gap-2 mb-2">
        <Cctv className="w-5 h-5" />
        <span className="font-medium text-sm">{data.name}</span>
      </div>
      <div className="text-xs text-gray-500">
        {t("click_to_jump", { name: data.name })}
      </div>
    </div>
  );
};

const ZLMNode = ({ data }: { data: any }) => {
  const editRef = useRef<any>(null);
  const queryClient = useQueryClient();
  const { t } = useTranslation("desktop");
  // 根据流媒体类型切换展示图标，避免配置与视觉提示不一致
  const mediaType = data.item?.type || "zlm";
  const mediaImage =
    mediaType === "zlm" ? "./assets/imgs/zlm.webp" : "./assets/imgs/lalmax.png";

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 w-52 relative">
      <div className="relative">
        {/* 状态指示灯 */}
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

        {/* 设置按钮 - 右上角 */}
        <div className="absolute top-1 right-1">
          <Tooltip
            title={
              <div>
                <p className="font-bold">{t("play_black_screen")}</p>
                <p>{t("tip_1")}</p>
                <p>{t("tip_2")}</p>
              </div>
            }
          >
            <button
              type="button"
              onClick={() => {
                editRef.current?.edit(data.item);
              }}
              className="bg-black/50 backdrop-blur-sm text-white p-0.5 rounded-full hover:bg-black/70 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>

        {/* 图片 */}
        <div className="flex justify-center mb-4">
          <img
            src={mediaImage}
            alt={mediaType === "zlm" ? "ZLM" : "Lalmax"}
            className="w-16 h-16 object-contain"
          />
        </div>

        {/* 端口小模块 - 垂直排列 */}
        <div className="space-y-3">
          <div className="relative flex items-center p-2 bg-purple-50 rounded border-l-4 border-purple-500">
            <Handle
              type="source"
              position={Position.Left}
              id="http-output"
              style={{
                background: "#722ed1",
                width: 8,
                height: 8,
                left: "-4px",
              }}
            />
            <div className="ml-2 font-medium text-xs">HTTP: {data.http}</div>
          </div>

          <div className="relative flex items-center p-2 bg-yellow-50 rounded border-l-4 border-yellow-500">
            <Handle
              type="target"
              position={Position.Left}
              id="rtp-input"
              style={{
                background: "#faad14",
                width: 8,
                height: 8,
                left: "-4px",
              }}
            />
            <div className="ml-2 font-medium text-xs">RTP: {data.rtp}</div>
          </div>

          <div className="relative flex items-center p-2 bg-blue-50 rounded border-l-4 border-blue-500">
            <Handle
              type="target"
              position={Position.Left}
              id="rtmp-input"
              style={{
                background: "#1890ff",
                width: 8,
                height: 8,
                left: "-4px",
              }}
            />
            <div className="ml-2 font-medium text-xs">RTMP: {data.rtmp}</div>
          </div>

          <div className="relative flex items-center p-2 bg-green-50 rounded border-l-4 border-green-500">
            <Handle
              type="target"
              position={Position.Left}
              id="rtsp-input"
              style={{
                background: "#52c41a",
                width: 8,
                height: 8,
                left: "-4px",
              }}
            />
            <div className="ml-2 font-medium text-xs">RTSP: {data.rtsp}</div>
          </div>
        </div>
      </div>

      <EditForm
        ref={editRef}
        onEditSuccess={() => {
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: [findMediaServersKey],
            });
          }, 370);
        }}
      />
    </div>
  );
};

const GoWVPNode = () => {
  const { t } = useTranslation("desktop");

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 w-52 relative">
      <div className="flex flex-col items-center">
        {/* 图片 */}
        <div className="flex justify-cent">
          <img
            src={"./assets/imgs/logo.png"}
            alt="GoWVP"
            className="w-36 object-contain"
          />
        </div>

        {/* 功能小模块 - 垂直排列 */}
        <div className="space-y-3 w-full">
          <div className="relative flex items-center p-2 bg-red-50 rounded border-r-4 border-red-500">
            <Handle
              type="target"
              position={Position.Right}
              id="http-15123-input"
              style={{
                background: "#f5222d",
                width: 8,
                height: 8,
                right: "-4px",
              }}
            />
            <div className="mr-2 font-medium text-xs text-right w-full">
              HTTP 15123
            </div>
          </div>

          <div className="relative flex items-center p-2 bg-orange-50 rounded border-l-4 border-orange-500">
            <Handle
              type="target"
              position={Position.Left}
              id="onvif-input"
              style={{
                background: "#fa8c16",
                width: 8,
                height: 8,
                left: "-4px",
              }}
            />
            <div className="ml-2 font-medium text-xs">ONVIF</div>
          </div>

          <div className="relative flex items-center p-2 bg-cyan-50 rounded border-l-4 border-cyan-500">
            <Handle
              type="target"
              position={Position.Left}
              id="gb28181-input"
              style={{
                background: "#13c2c2",
                width: 8,
                height: 8,
                left: "-4px",
              }}
            />
            <div className="ml-2 font-medium text-xs">{t("gb_signaling")}</div>
          </div>

          <div className="relative flex items-center p-2 bg-purple-50 rounded border-l-4 border-purple-500">
            <Handle
              type="target"
              position={Position.Left}
              id="zlm-input"
              style={{
                background: "#722ed1",
                width: 8,
                height: 8,
                left: "-4px",
              }}
            />
            <div className="ml-2 font-medium text-xs">
              {t("zlm_connection")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ClientNode = () => {
  const { t } = useTranslation("desktop");

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 w-32 relative">
      {/* 连接点 */}
      <Handle
        type="source"
        position={Position.Left}
        id="output"
        style={{ background: "#f5222d", width: 8, height: 8, top: "50%" }}
      />

      <div className="flex flex-col items-center">
        {/* 图片 */}
        <div className="flex justify-center mb-4">
          <img
            src={"./assets/imgs/chrome.png"}
            alt="Client"
            className="w-10 h-10 object-contain"
          />
        </div>

        {/* 端口信息 */}
        <div className="text-xs text-center">
          <div className="p-2 bg-gray-50 rounded">
            <div className="font-medium">{t("web_management")}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 节点类型映射
const nodeTypes = {
  ipc: SimpleNode,
  zlm: ZLMNode,
  gowvp: GoWVPNode,
  client: ClientNode,
};

// 初始节点数据生成函数
const getInitialNodes = (t: any): Node[] => [
  {
    id: "gowvp",
    type: "gowvp",
    position: { x: 350, y: 100 }, // GoWVP往下移，靠近ZLM
    data: {
      name: "GOWVP",
      value: 0,
    },
  },
  {
    id: "client",
    type: "client",
    position: { x: 650, y: 150 }, // Client往下移
    data: {
      name: "client",
      value: 0,
    },
  },
  {
    id: "rtmp",
    type: "ipc",
    position: { x: 50, y: 480 }, // RTMP往下移
    data: { name: t("desktop:rtmp_push"), value: 0, path: "/rtmps" },
  },
  {
    id: "rtsp",
    type: "ipc",
    position: { x: 50, y: 580 }, // RTSP往下移
    data: { name: t("desktop:rtsp_pull"), value: 0, path: "/rtsps" },
  },
  {
    id: "gb28181",
    type: "ipc",
    position: { x: 50, y: 250 }, // GB28181移到中间位置
    data: { name: "GB/T28181", value: 0, path: "/nchannels" },
  },
  {
    id: "onvif",
    type: "ipc",
    position: { x: 50, y: 150 }, // ONVIF在GB28181上方
    data: { name: "ONVIF", value: 0, path: "/nchannels" },
  },
  {
    id: "zlm",
    type: "zlm",
    position: { x: 350, y: 420 }, // ZLM往上移，靠近GoWVP
    data: {
      name: "zlm",
      value: 0,
      rtmp: 1935,
      rtsp: 554,
      rtp: "0.0.0.0:10000-20000(UDP/TCP)",
      http: "0.0.0.0:80",
      item: null,
    },
  },
];

// 初始边数据
const initialEdges: Edge[] = [
  {
    id: "rtmp->zlm",
    source: "rtmp",
    target: "zlm",
    sourceHandle: "output",
    targetHandle: "rtmp-input",
    animated: true,
    style: { stroke: "#1890ff", strokeWidth: 2 },
  },
  {
    id: "rtsp->zlm",
    source: "rtsp",
    target: "zlm",
    sourceHandle: "output",
    targetHandle: "rtsp-input",
    animated: true,
    style: { stroke: "#52c41a", strokeWidth: 2 },
  },
  {
    id: "gb28181->zlm",
    source: "gb28181",
    target: "zlm",
    sourceHandle: "output",
    targetHandle: "rtp-input",
    animated: true,
    style: { stroke: "#faad14", strokeWidth: 2 },
  },
  {
    id: "zlm->gowvp",
    source: "zlm",
    target: "gowvp",
    sourceHandle: "http-output",
    targetHandle: "zlm-input", // ZLM HTTP(左侧顶部) 连接到 GoWVP ZLM连接(左侧底部)
    animated: true,
    style: { stroke: "#722ed1", strokeWidth: 2 },
    type: "smoothstep", // 使用smoothstep避免垂直遮挡，形成弯曲连接线
  },
  {
    id: "gb28181->gowvp",
    source: "gb28181",
    target: "gowvp",
    sourceHandle: "output",
    targetHandle: "gb28181-input", // GB/T28181 连接到 GoWVP 左侧的国标信令
    animated: true,
    style: { stroke: "#13c2c2", strokeWidth: 2 },
  },
  {
    id: "onvif->gowvp",
    source: "onvif",
    target: "gowvp",
    sourceHandle: "output",
    targetHandle: "onvif-input", // ONVIF 连接到 GoWVP 左侧的 ONVIF 端口
    animated: true,
    style: { stroke: "#fa8c16", strokeWidth: 2 },
  },
  {
    id: "client->gowvp",
    source: "client",
    target: "gowvp",
    sourceHandle: "output",
    targetHandle: "http-15123-input", // 网页后台管理连接到 GoWVP 右侧的 HTTP 15123
    animated: true,
    style: { stroke: "#f5222d", strokeWidth: 2 },
  },
];

export default function DesktopView() {
  const { t } = useTranslation(["desktop", "common"]);
  const [nodes, setNodes] = useState<Node[]>(getInitialNodes(t));
  const [edges] = useState<Edge[]>(initialEdges);

  const { data } = useQuery({
    queryKey: [findMediaServersKey],
    queryFn: () => FindMediaServers(),
    throwOnError: (error) => {
      ErrorHandle(error);
      return true;
    },
  });

  // 当语言切换时，重新生成节点数据
  useEffect(() => {
    setNodes(getInitialNodes(t));
  }, [t]);

  // 更新 ZLM 节点数据
  useEffect(() => {
    if (!data?.data.items[0]) return;

    const item = data.data.items[0];
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === "zlm") {
          return {
            ...node,
            data: {
              ...node.data,
              rtmp: item.ports?.rtmp || 1935,
              rtsp: item.ports?.rtsp || 554,
              rtp: `${item.sdp_ip}:${item.rtpport_range}(UDP/TCP)`,
              http: `${item.ip}:${item.ports?.http}`,
              item: item,
            },
          };
        }
        return node;
      }),
    );
  }, [data]);

  return (
    <div className="h-screen w-screen pb-24 ">
      <style>
        {`
          /* 隐藏 React Flow attribution */
          .react-flow__attribution {
            display: none !important;
          }

        `}
      </style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
          includeHiddenNodes: false,
          minZoom: 1,
          maxZoom: 1.2,
        }}
        attributionPosition="bottom-left"
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        onNodesChange={() => {
          // 禁用拖动时不处理任何变化
        }}
      >
        <Background />
        <Controls />
        {/* 删除 MiniMap */}
      </ReactFlow>
    </div>
  );
}
