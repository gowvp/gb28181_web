import type { Edge, Node } from "@xyflow/react";
import {
  Background,
  Controls,
  Handle,
  Panel,
  Position,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { Tooltip } from "antd";
import {
  Bell,
  Cctv,
  ChevronUp,
  Github,
  Home,
  Languages,
  Layers,
  LogOut,
  Map as MapIcon,
  MonitorUp,
  Settings,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import FloorPlanEditor from "./floor_plan";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  FindMediaServers,
  findMediaServersKey,
} from "~/service/api/media/media";
import { checkVersion, checkVersionKey } from "~/service/api/version/version";
import { ErrorHandle } from "~/service/config/error";
import { EditForm } from "./media/edit";

// ── 节点组件 ──────────────────────────

const SimpleNode = ({ data }: { data: any }) => {
  const navigate = useNavigate();
  const { t } = useTranslation("desktop");

  const handleClick = useCallback(() => {
    if (data.path) {
      navigate(data.path);
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
  const mediaType = data.item?.type || "zlm";
  const mediaImage =
    mediaType === "zlm"
      ? "./assets/imgs/zlm.avif"
      : "./assets/imgs/lalmax.avif";

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 w-52 relative">
      <div className="relative">
        <div className="absolute top-1 left-1">
          <div className="relative">
            <div
              className={`absolute w-2 h-2 rounded-full ${
                data.item?.status ? "bg-green-500" : "bg-red-500"
              } animate-ping`}
            />
            <div
              className={`w-2 h-2 rounded-full ${
                data.item?.status ? "bg-green-500" : "bg-red-500"
              }`}
            />
          </div>
        </div>

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

        <div className="flex justify-center mb-4">
          <img
            src={mediaImage}
            alt={mediaType === "zlm" ? "ZLM" : "Lalmax"}
            className="w-16 h-16 object-contain"
          />
        </div>

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

const GoWVPNode = ({ data }: { data: { version?: string } }) => {
  const { t } = useTranslation("desktop");

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 w-52 relative">
      <div className="flex flex-col items-center">
        <div className="flex justify-center relative">
          <img
            src={"./assets/imgs/logo.avif"}
            alt="GoWVP"
            className="w-24 object-contain"
          />
          {data.version && (
            <span className="absolute -bottom-1 -right-2 text-[10px] text-gray-400 font-mono">
              {data.version}
            </span>
          )}
        </div>

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
      <Handle
        type="source"
        position={Position.Left}
        id="output"
        style={{ background: "#f5222d", width: 8, height: 8, top: "50%" }}
      />
      <div className="flex flex-col items-center">
        <div className="flex justify-center mb-4">
          <img
            src={"./assets/imgs/chrome.png"}
            alt="Client"
            className="w-10 h-10 object-contain"
          />
        </div>
        <div className="text-xs text-center">
          <div className="p-2 bg-gray-50 rounded">
            <div className="font-medium">{t("web_management")}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  ipc: SimpleNode,
  zlm: ZLMNode,
  gowvp: GoWVPNode,
  client: ClientNode,
};

const getInitialNodes = (t: any): Node[] => [
  {
    id: "gowvp",
    type: "gowvp",
    position: { x: 350, y: 100 },
    data: { name: "GOWVP", value: 0, version: "" },
  },
  {
    id: "client",
    type: "client",
    position: { x: 650, y: 150 },
    data: { name: "client", value: 0 },
  },
  {
    id: "rtmp",
    type: "ipc",
    position: { x: 50, y: 480 },
    data: { name: t("desktop:rtmp_push"), value: 0, path: "/rtmps" },
  },
  {
    id: "rtsp",
    type: "ipc",
    position: { x: 50, y: 580 },
    data: { name: t("desktop:rtsp_pull"), value: 0, path: "/rtsps" },
  },
  {
    id: "gb28181",
    type: "ipc",
    position: { x: 50, y: 250 },
    data: { name: "GB/T28181", value: 0, path: "/nchannels" },
  },
  {
    id: "onvif",
    type: "ipc",
    position: { x: 50, y: 150 },
    data: { name: "ONVIF", value: 0, path: "/nchannels" },
  },
  {
    id: "zlm",
    type: "zlm",
    position: { x: 350, y: 420 },
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

const initialEdges: Edge[] = [
  { id: "rtmp->zlm", source: "rtmp", target: "zlm", sourceHandle: "output", targetHandle: "rtmp-input", animated: true, style: { stroke: "#1890ff", strokeWidth: 2 } },
  { id: "rtsp->zlm", source: "rtsp", target: "zlm", sourceHandle: "output", targetHandle: "rtsp-input", animated: true, style: { stroke: "#52c41a", strokeWidth: 2 } },
  { id: "gb28181->zlm", source: "gb28181", target: "zlm", sourceHandle: "output", targetHandle: "rtp-input", animated: true, style: { stroke: "#faad14", strokeWidth: 2 } },
  { id: "zlm->gowvp", source: "zlm", target: "gowvp", sourceHandle: "http-output", targetHandle: "zlm-input", animated: true, style: { stroke: "#722ed1", strokeWidth: 2 }, type: "smoothstep" },
  { id: "gb28181->gowvp", source: "gb28181", target: "gowvp", sourceHandle: "output", targetHandle: "gb28181-input", animated: true, style: { stroke: "#13c2c2", strokeWidth: 2 } },
  { id: "onvif->gowvp", source: "onvif", target: "gowvp", sourceHandle: "output", targetHandle: "onvif-input", animated: true, style: { stroke: "#fa8c16", strokeWidth: 2 } },
  { id: "client->gowvp", source: "client", target: "gowvp", sourceHandle: "output", targetHandle: "http-15123-input", animated: true, style: { stroke: "#f5222d", strokeWidth: 2 } },
];

// ── 主组件 ──────────────────────────

export default function DesktopView() {
  const { t, i18n } = useTranslation(["desktop", "common"]);
  const [viewMode, setViewMode] = useState<"dataflow" | "2d">("dataflow");
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

  const { data: versionData } = useQuery({
    queryKey: [checkVersionKey],
    queryFn: checkVersion,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setNodes(getInitialNodes(t));
  }, [t]);

  useEffect(() => {
    if (!versionData?.current_version) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === "gowvp") {
          return { ...node, data: { ...node.data, version: versionData.current_version } };
        }
        return node;
      }),
    );
  }, [versionData]);

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
    <div className="h-screen w-screen relative" style={{ background: "linear-gradient(to bottom right, white 30%, #FCFEFF 70%)" }}>
      <style>
        {`.react-flow__attribution { display: none !important; }`}
      </style>

      {viewMode === "dataflow" ? (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2, includeHiddenNodes: false, minZoom: 1, maxZoom: 1.2 }}
          attributionPosition="bottom-left"
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          onNodesChange={() => {}}
        >
          <Background />
          <Controls />
          <Panel position="top-left">
            <ViewSwitchBar viewMode={viewMode} onViewModeChange={setViewMode} t={t} />
          </Panel>
        </ReactFlow>
      ) : (
        <FloorPlanEditor viewMode={viewMode} onViewModeChange={setViewMode} />
      )}

      {/* 右下角悬浮菜单 */}
      <DesktopFab i18n={i18n} />
    </div>
  );
}

// ── 左上角视图切换栏（数据流 tab 使用 Panel，2D tab 由 FloorPlanEditor 自行渲染） ──

function ViewSwitchBar({
  viewMode,
  onViewModeChange,
  t,
}: {
  viewMode: "dataflow" | "2d";
  onViewModeChange: (mode: "dataflow" | "2d") => void;
  t: any;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5 bg-white rounded-lg shadow border border-gray-200 p-0.5">
        <ViewSwitchButton
          icon={<Layers style={{ width: 16, height: 16 }} />}
          active={viewMode === "dataflow"}
          onClick={() => onViewModeChange("dataflow")}
          tooltip={t("desktop:dataflow")}
        />
        <ViewSwitchButton
          icon={<MapIcon style={{ width: 16, height: 16 }} />}
          active={viewMode === "2d"}
          onClick={() => onViewModeChange("2d")}
          tooltip="2D"
        />
      </div>
    </div>
  );
}

function ViewSwitchButton({
  icon,
  active,
  onClick,
  tooltip,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  tooltip: string;
}) {
  return (
    <button
      type="button"
      title={tooltip}
      onClick={onClick}
      className={`
        w-7 h-7 rounded flex items-center justify-center transition-colors
        ${active
          ? "bg-gray-900 text-white"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        }
      `}
    >
      {icon}
    </button>
  );
}

// ── 右下角悬浮操作按钮（FAB） ──────────────────────────

function DesktopFab({ i18n }: { i18n: any }) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as HTMLElement)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const menuItems = [
    { icon: Home, label: t("quick_desktop"), action: () => navigate("/desktop") },
    { icon: Cctv, label: t("gb_channel"), action: () => navigate("/nchannels") },
    { icon: Bell, label: t("alerts"), action: () => navigate("/alerts") },
    { icon: MonitorUp, label: t("rtmp_stream"), action: () => navigate("/rtmps") },
    { icon: Waypoints, label: t("rtsp_proxy"), action: () => navigate("/rtsps") },
    { icon: Languages, label: t("language"), action: () => {
      const next = i18n.language === "zh" ? "en" : "zh";
      i18n.changeLanguage(next);
    }},
    { icon: Github, label: "Github", action: () => window.open("https://github.com/gowvp/gb28181") },
    { icon: Sparkles, label: "Gitee", action: () => window.open("https://gitee.com/gowvp/gb28181") },
  ];

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* 展开的菜单项 */}
      <div
        className={`flex flex-col gap-1 transition-all duration-200 origin-bottom ${
          open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[160px]">
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => { item.action(); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <item.icon className="w-4 h-4 text-gray-500" />
              {item.label}
            </button>
          ))}
          <div className="border-t border-gray-200 my-1" />
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/");
            }}
            className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t("logout")}
          </button>
        </div>
      </div>

      {/* 头像按钮 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`
          w-12 h-12 rounded-full shadow-lg border-2 transition-all duration-200
          flex items-center justify-center overflow-hidden
          ${open ? "border-gray-900 ring-2 ring-gray-900/20" : "border-white hover:border-gray-300"}
        `}
      >
        <Avatar className="w-full h-full">
          <AvatarImage src="./assets/imgs/bg.avif" alt="User" />
          <AvatarFallback className="bg-gray-900 text-white text-sm">
            <ChevronUp className={`w-5 h-5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </AvatarFallback>
        </Avatar>
      </button>
    </div>
  );
}
