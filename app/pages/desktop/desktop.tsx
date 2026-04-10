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
import {
  loadDesktopViewMode,
  saveDesktopViewMode,
  type DesktopViewMode,
} from "./desktop-view-mode";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  FindMediaServers,
  findMediaServersKey,
} from "~/service/api/media/media";
import { checkVersion, checkVersionKey } from "~/service/api/version/version";
import { ErrorHandle } from "~/service/config/error";
import { EditForm } from "./media/edit";

// ── 节点组件 ──────────────────────────

/**
 * 为什么拓扑节点用独立小组件而不是内联 data 渲染：
 * React Flow 按 node type 查找组件，拆分后才能在节点内局部使用 hooks（如导航）而不把 Desktop 主组件撑成巨石。
 */
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

/**
 * 为什么流媒体节点内嵌编辑表单：
 * 现场改端口/IP 是高频操作，跳转到独立页会打断拓扑扫视；就地编辑成功后失效查询即可与列表页数据对齐。
 */
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

/**
 * 为什么 GoWVP 节点只展示静态端口示意：
 * 该节点表达的是「能力入口」而非实时连接状态，避免与 ZLM 的运行态指示混淆，减少误读为「已连通」。
 */
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

/**
 * 为什么单独画「浏览器客户端」节点：
 * 拓扑上用户终端与信令/媒体路径并列，单独成节点能强调「管理端从哪进」，与设备侧入口区分。
 */
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

/**
 * 为什么初始边写死在模块级：
 * 首页拓扑是静态示意而非实时链路，避免为展示图拉取图数据增加首屏请求；媒体服务器数据只增强 ZLM 节点。
 */
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

/**
 * 为什么桌面页同时挂载数据流与 2D 编辑器却条件渲染：
 * 2D 编辑器含 Konva 与大量监听，常驻双实例会拖慢低配机；按模式挂载保留首屏性能，又避免两套路由重复拉权限。
 */
export default function DesktopView() {
  const { t, i18n } = useTranslation(["desktop", "common"]);
  const [viewMode, setViewMode] = useState<DesktopViewMode>(() => loadDesktopViewMode() ?? "dataflow");
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
    saveDesktopViewMode(viewMode);
  }, [viewMode]);

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
    <div
      className="relative h-dvh min-h-screen w-screen md:h-screen"
      style={{ background: "linear-gradient(to bottom right, white 30%, #FCFEFF 70%)" }}
    >
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

/**
 * 为什么数据流模式仍保留顶栏切换：
 * 用户在 ReactFlow 内时无法使用 FloorPlanEditor 内嵌切换，必须在 Panel 提供等价入口，否则切到 2D 后难以返回。
 */
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
    <div className="flex items-center gap-2 rounded-xl border border-gray-200/80 bg-white/95 p-2 shadow-sm backdrop-blur">
      <ViewSwitchButton
        icon={<Layers className="h-4 w-4" />}
        active={viewMode === "dataflow"}
        onClick={() => onViewModeChange("dataflow")}
        tooltip={t("desktop:dataflow")}
      />
      <ViewSwitchButton
        icon={<MapIcon className="h-4 w-4" />}
        active={viewMode === "2d"}
        onClick={() => onViewModeChange("2d")}
        tooltip={t("desktop:floor_plan_mode")}
      />
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
      className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {icon}
    </button>
  );
}

// ── 右下角悬浮操作按钮（FAB） ──────────────────────────

/**
 * 为什么快捷入口用 FAB 而不是顶栏铺满：
 * 桌面页主体已被拓扑/2D 占满，顶栏再堆链接会抢视线；FAB 聚合低频跳转，避免打断主画布。
 */
function DesktopFab({ i18n }: { i18n: any }) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * 为什么用 mousedown 监听 document 关菜单：
   * 菜单展开时用户可能去点画布或其它区域，若只 toggle 头像会留下遮罩层挡住操作；捕获阶段外点击更符合弹层习惯。
   */
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

  /**
   * 为什么外层 pointer-events-none、仅头像与展开菜单可点：
   * 关闭时若仍渲染占位列（opacity-0），在 flex column 里会挡住画布右下角，悬停卡片与 Konva 命中被吞；关闭则完全不占位。
   */
  return (
    <div ref={containerRef} className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open ? (
        <div className="pointer-events-auto flex flex-col gap-1 transition-all duration-200 origin-bottom opacity-100 scale-100">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[160px]">
            {menuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  item.action();
                  setOpen(false);
                }}
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
      ) : null}

      {/* 头像按钮 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`
          pointer-events-auto w-12 h-12 rounded-full shadow-lg border-2 transition-all duration-200
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
