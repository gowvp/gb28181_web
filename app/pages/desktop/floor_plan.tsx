import {
  Background,
  Controls,
  Panel,
  ReactFlow,
} from "@xyflow/react";
import { Camera, Eraser, Layers, Map as MapIcon, Move, Pencil, RotateCcw, Tag, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

// ── 六边形画色板 ──────────────────────────

export const FLOOR_PLAN_PALETTE = [
  "#6b7280",
  "#94a3b8",
  "#d4a574",
  "#a8c5a0",
  "#b8c5d6",
  "#d4b8c5",
  "#c5c0a8",
] as const;

interface HexCell {
  q: number;
  r: number;
  color: string | null;
  roomName: string | null;
}

interface CameraMarker {
  id: string;
  q: number;
  r: number;
  angle: number;
  fov: number;
  range: number;
  channelId: string | null;
  channelName: string | null;
}

type EditorMode = "paint" | "erase" | "label" | "camera" | "pan";

// ── 六边形几何 (flat-top) ──────────────────────────

const HEX_SIZE = 28;

function hexToPixel(q: number, r: number): [number, number] {
  const x = HEX_SIZE * (3 / 2) * q;
  const y = HEX_SIZE * Math.sqrt(3) * (r + q / 2);
  return [x, y];
}

function pixelToHex(px: number, py: number): [number, number] {
  const q = ((2 / 3) * px) / HEX_SIZE;
  const r = ((-1 / 3) * px + (Math.sqrt(3) / 3) * py) / HEX_SIZE;
  return cubeRound(q, r);
}

function cubeRound(q: number, r: number): [number, number] {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}

function hexCorners(cx: number, cy: number, size: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const rad = (Math.PI / 180) * 60 * i;
    points.push(`${cx + size * Math.cos(rad)},${cy + size * Math.sin(rad)}`);
  }
  return points.join(" ");
}

function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

function generateHexGrid(radius: number): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      cells.push([q, r]);
    }
  }
  return cells;
}

// ── 工具栏按钮组件 ──────────────────────────

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            className={`
              w-8 h-8 rounded-md flex items-center justify-center transition-colors
              ${active
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }
            `}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── FloorPlanEditor ──────────────────────────

const GRID_RADIUS = 30;

interface FloorPlanEditorProps {
  viewMode: "dataflow" | "2d";
  onViewModeChange: (mode: "dataflow" | "2d") => void;
}

export default function FloorPlanEditor({ viewMode, onViewModeChange }: FloorPlanEditorProps) {
  const { t } = useTranslation("desktop");

  const [cells, setCells] = useState<Map<string, HexCell>>(new Map());
  const [cameras, setCameras] = useState<CameraMarker[]>([]);
  const [mode, setMode] = useState<EditorMode>("paint");
  const [selectedColor, setSelectedColor] = useState<string>(FLOOR_PLAN_PALETTE[0]);
  const [isEditing, setIsEditing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [labelInput, setLabelInput] = useState("");
  const [labelTarget, setLabelTarget] = useState<string | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffset = useRef({ x: 0, y: 0 });
  const isPainting = useRef(false);

  const gridCoords = useMemo(() => generateHexGrid(GRID_RADIUS), []);

  // ── 坐标转换（通过 <g> 的 CTM 直接获取变换后坐标，自动包含 zoom/pan） ──

  const svgPoint = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const g = gRef.current;
      if (!g) return [0, 0];
      const ctm = g.getScreenCTM();
      if (!ctm) return [0, 0];
      const inv = ctm.inverse();
      const x = inv.a * clientX + inv.c * clientY + inv.e;
      const y = inv.b * clientX + inv.d * clientY + inv.f;
      return [x, y];
    },
    [],
  );

  // ── 画笔操作（仅用于 mouseMove 拖拽涂色） ──────────────────────────

  const applyBrush = useCallback(
    (q: number, r: number) => {
      const key = hexKey(q, r);
      setCells((prev) => {
        const next = new Map(prev);
        if (mode === "paint") {
          const existing = next.get(key);
          next.set(key, {
            q,
            r,
            color: selectedColor,
            roomName: existing?.roomName ?? null,
          });
        } else if (mode === "erase") {
          next.delete(key);
        }
        return next;
      });
    },
    [mode, selectedColor],
  );

  // ── polygon 的 onClick（所有模式统一入口，避免和 mouseDown 重复） ──

  const handleHexClick = useCallback(
    (q: number, r: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isEditing) return;

      if (mode === "label") {
        const key = hexKey(q, r);
        if (cells.has(key)) {
          setLabelTarget(key);
          setLabelInput(cells.get(key)?.roomName || "");
        }
      } else if (mode === "camera") {
        const key = hexKey(q, r);
        if (cells.has(key)) {
          const existing = cameras.find((c) => c.q === q && c.r === r);
          if (existing) {
            setSelectedCamera(existing.id);
          } else {
            const newCam: CameraMarker = {
              id: `cam-${Date.now()}`,
              q,
              r,
              angle: 0,
              fov: Math.PI / 3,
              range: 80,
              channelId: null,
              channelName: null,
            };
            setCameras((prev) => [...prev, newCam]);
            setSelectedCamera(newCam.id);
          }
        }
      }
      // paint / erase 由 mouseDown + mouseMove 处理，不在 onClick 中处理
    },
    [isEditing, mode, cells, cameras],
  );

  // ── 鼠标事件 ──────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 平移：pan 模式 / 中键 / Alt+左键
      if (mode === "pan" || e.button === 1 || (e.button === 0 && e.altKey)) {
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY };
        panOffset.current = { ...pan };
        e.preventDefault();
        return;
      }

      if (!isEditing || e.button !== 0) return;

      // 画笔/橡皮擦：立即涂第一个格子，然后拖拽继续涂
      if (mode === "paint" || mode === "erase") {
        isPainting.current = true;
        const [px, py] = svgPoint(e.clientX, e.clientY);
        const [q, r] = pixelToHex(px, py);
        applyBrush(q, r);
      }
    },
    [mode, isEditing, pan, svgPoint, applyBrush],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning.current) {
        setPan({
          x: panOffset.current.x + (e.clientX - panStart.current.x) / zoom,
          y: panOffset.current.y + (e.clientY - panStart.current.y) / zoom,
        });
        return;
      }
      if (isPainting.current && isEditing && (mode === "paint" || mode === "erase")) {
        const [px, py] = svgPoint(e.clientX, e.clientY);
        const [q, r] = pixelToHex(px, py);
        applyBrush(q, r);
      }
    },
    [zoom, isEditing, mode, svgPoint, applyBrush],
  );

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    isPainting.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setZoom((z) => Math.max(0.3, Math.min(3, z * delta)));
  }, []);

  // ── 标签 ──────────────────────────

  const confirmLabel = useCallback(() => {
    if (!labelTarget) return;
    setCells((prev) => {
      const next = new Map(prev);
      const cell = next.get(labelTarget);
      if (cell) {
        next.set(labelTarget, { ...cell, roomName: labelInput || null });
      }
      return next;
    });
    setLabelTarget(null);
    setLabelInput("");
  }, [labelTarget, labelInput]);

  // ── 摄像头 ──────────────────────────

  const deleteCamera = useCallback((id: string) => {
    setCameras((prev) => prev.filter((c) => c.id !== id));
    setSelectedCamera(null);
  }, []);

  const updateCamera = useCallback(
    (id: string, updates: Partial<CameraMarker>) => {
      setCameras((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      );
    },
    [],
  );

  const roomNames = useMemo(() => {
    const names = new Set<string>();
    for (const cell of cells.values()) {
      if (cell.roomName) names.add(cell.roomName);
    }
    return Array.from(names);
  }, [cells]);

  const resetCanvas = useCallback(() => {
    setCells(new Map());
    setCameras([]);
    setSelectedCamera(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // ── 容器尺寸和 viewBox 计算 ──────────────────────────

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 1200, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setContainerSize({ w: width, h: height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // viewBox 高度固定为 1200，宽度按容器宽高比缩放
  const vbH = 1200;
  const vbW = (containerSize.w / containerSize.h) * vbH;
  const halfW = vbW / 2;
  const halfH = vbH / 2;

  const cursorStyle = useMemo(() => {
    if (isPanning.current) return "grabbing";
    if (mode === "pan") return "grab";
    if (!isEditing) return "default";
    if (mode === "paint" || mode === "erase") return "crosshair";
    if (mode === "label") return "text";
    if (mode === "camera") return "crosshair";
    return "default";
  }, [mode, isEditing]);

  return (
    <div className="h-full w-full relative bg-gray-50">
      {/* ReactFlow 壳层：仅用于提供 Controls 和 Panel UI，不处理交互 */}
      <div className="absolute inset-0 z-2 pointer-events-none">
      <ReactFlow
        nodes={[]}
        edges={[]}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        style={{ pointerEvents: "none" }}
      >
        <Controls className="pointer-events-auto" />

        {/* 左上角：视图切换 + 编辑按钮（同行同高） */}
        <Panel position="top-left" className="pointer-events-auto">
          <div className="flex items-center gap-2">
            {/* 视图切换 */}
            <div className="flex gap-0.5 bg-white rounded-lg shadow border border-gray-200 p-0.5">
              <button
                type="button"
                title={t("dataflow")}
                onClick={() => onViewModeChange("dataflow")}
                className="w-7 h-7 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
              >
                <Layers style={{ width: 16, height: 16 }} />
              </button>
              <button
                type="button"
                title="2D"
                className="w-7 h-7 rounded flex items-center justify-center bg-gray-900 text-white transition-colors"
              >
                <MapIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* 编辑按钮（与切换按钮同行同高） */}
            <Button
              variant={isEditing ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="gap-1.5 h-8"
            >
              <Pencil className="h-3.5 w-3.5" />
              {isEditing ? t("editing") : t("edit")}
            </Button>

            {/* 编辑工具栏 */}
            {isEditing && (
              <>
                <div className="h-5 w-px bg-gray-300" />
                <div className="flex items-center gap-1">
                  <ToolButton active={mode === "paint"} onClick={() => setMode("paint")} title={t("paint")}>
                    <Pencil className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton active={mode === "erase"} onClick={() => setMode("erase")} title={t("eraser")}>
                    <Eraser className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton active={mode === "label"} onClick={() => setMode("label")} title={t("label_tool")}>
                    <Tag className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton active={mode === "camera"} onClick={() => setMode("camera")} title={t("camera_tool")}>
                    <Camera className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton active={mode === "pan"} onClick={() => setMode("pan")} title={t("pan_tool")}>
                    <Move className="h-4 w-4" />
                  </ToolButton>
                </div>
                <div className="h-5 w-px bg-gray-300" />
                {mode === "paint" && (
                  <div className="flex items-center gap-1.5">
                    {FLOOR_PLAN_PALETTE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                          selectedColor === color
                            ? "border-gray-900 scale-110 ring-2 ring-gray-900/20"
                            : "border-gray-300"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                )}
                {mode === "paint" && <div className="h-5 w-px bg-gray-300" />}
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetCanvas}
                        className="h-8 w-8 p-0 text-gray-500 hover:text-red-500"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("reset_canvas")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </div>
        </Panel>
      </ReactFlow>
      </div>

      {/* SVG 画布 */}
      <div ref={containerRef} className="absolute inset-0 z-1">
        <svg
          ref={svgRef}
          className="w-full h-full"
          viewBox={`${-halfW} ${-halfH} ${vbW} ${vbH}`}
          style={{ cursor: cursorStyle }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <g ref={gRef} transform={`scale(${zoom}) translate(${pan.x}, ${pan.y})`}>
            {gridCoords.map(([q, r]) => {
              const [cx, cy] = hexToPixel(q, r);
              const key = hexKey(q, r);
              const cell = cells.get(key);
              const isFilled = !!cell;

              return (
                <g key={key}>
                  <polygon
                    points={hexCorners(cx, cy, HEX_SIZE - 1)}
                    fill={isFilled ? (cell.color || FLOOR_PLAN_PALETTE[0]) : "transparent"}
                    stroke={isFilled ? "#9ca3af" : (isEditing ? "#c0c0c0" : "#d0d0d0")}
                    strokeWidth={isFilled ? 1.5 : 1}
                    strokeDasharray={!isFilled ? "4,3" : "none"}
                    opacity={isFilled ? 1 : (isEditing ? 0.8 : 0.6)}
                    className={isEditing && !isFilled ? "hover:opacity-100" : ""}
                    style={{ cursor: isEditing ? "pointer" : "default" }}
                    onClick={(e) => handleHexClick(q, r, e)}
                  />
                  {isFilled && cell.roomName && (
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={8}
                      fontWeight={600}
                      fill="white"
                      className="pointer-events-none select-none"
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
                    >
                      {cell.roomName}
                    </text>
                  )}
                </g>
              );
            })}

            {/* 摄像头 */}
            {cameras.map((cam) => {
              const [cx, cy] = hexToPixel(cam.q, cam.r);
              const isSelected = selectedCamera === cam.id;
              const fovHalf = cam.fov / 2;
              const rad = (cam.angle * Math.PI) / 180;
              const x1 = cx + cam.range * Math.cos(rad - fovHalf);
              const y1 = cy + cam.range * Math.sin(rad - fovHalf);
              const x2 = cx + cam.range * Math.cos(rad + fovHalf);
              const y2 = cy + cam.range * Math.sin(rad + fovHalf);
              const largeArcFlag = cam.fov > Math.PI ? 1 : 0;

              return (
                <g key={cam.id}>
                  <path
                    d={`M ${cx} ${cy} L ${x1} ${y1} A ${cam.range} ${cam.range} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                    fill={isSelected ? "rgba(59,130,246,0.15)" : "rgba(100,116,139,0.08)"}
                    stroke={isSelected ? "#3b82f6" : "#94a3b8"}
                    strokeWidth={isSelected ? 1.5 : 0.8}
                    strokeDasharray="4,2"
                  />
                  {/* 摄像头圆点 + 方向线 */}
                  <g
                    transform={`translate(${cx}, ${cy})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isEditing && mode === "camera") {
                        setSelectedCamera(cam.id);
                      }
                    }}
                    style={{ cursor: isEditing ? "pointer" : "default" }}
                  >
                    <circle
                      r={10}
                      fill={isSelected ? "#3b82f6" : "#475569"}
                      stroke="white"
                      strokeWidth={2}
                    />
                    {/* Cctv 图标（lucide cctv 的 SVG path，缩放到 12x12 并居中） */}
                    <g transform="translate(-6,-6) scale(0.5)" fill="none" stroke="white" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16.75 12h3.632a1 1 0 0 1 .894 1.447l-2.034 4.069a1 1 0 0 1-1.708.134l-2.124-2.97" />
                      <path d="M17.106 9.053a1 1 0 0 1 .447 1.341l-3.106 6.211a1 1 0 0 1-1.342.447L3.61 12.3a2.92 2.92 0 0 1-1.3-3.91L3.69 5.6a2.92 2.92 0 0 1 3.92-1.3z" />
                      <path d="M2 19h3.76a2 2 0 0 0 1.8-1.1L9 15" />
                      <path d="M2 21v-4" />
                      <circle cx={7} cy={9} r={0.5} fill="white" />
                    </g>
                    <line
                      x1={0} y1={0}
                      x2={16 * Math.cos(rad)} y2={16 * Math.sin(rad)}
                      stroke={isSelected ? "#3b82f6" : "#475569"}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  </g>
                  {cam.channelName && (
                    <text
                      x={cx} y={cy + 18}
                      textAnchor="middle"
                      fontSize={7}
                      fill="#475569"
                      fontWeight={500}
                      className="pointer-events-none select-none"
                    >
                      {cam.channelName}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* 标签输入浮层 */}
        {labelTarget && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg border border-gray-200 p-3 flex items-center gap-2 z-20">
            <Tag className="h-4 w-4 text-gray-400 shrink-0" />
            <Input
              autoFocus
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmLabel();
                if (e.key === "Escape") {
                  setLabelTarget(null);
                  setLabelInput("");
                }
              }}
              placeholder={t("room_name_placeholder")}
              className="w-32 h-8 text-sm"
            />
            <Button size="sm" onClick={confirmLabel}>
              {t("confirm")}
            </Button>
          </div>
        )}

        {/* 摄像头属性面板 */}
        {isEditing && selectedCamera && cameras.find((c) => c.id === selectedCamera) && (
          <CameraPanel
            camera={cameras.find((c) => c.id === selectedCamera)!}
            onUpdate={(updates) => updateCamera(selectedCamera, updates)}
            onDelete={() => deleteCamera(selectedCamera)}
            onClose={() => setSelectedCamera(null)}
          />
        )}

        {/* 房间列表 */}
        {roomNames.length > 0 && (
          <div className="absolute bottom-4 left-16 bg-white/90 backdrop-blur-sm rounded-lg shadow border border-gray-200 p-3" style={{ zIndex: 2 }}>
            <div className="text-xs font-medium text-gray-500 mb-2">{t("rooms")}</div>
            <div className="flex flex-wrap gap-1.5">
              {roomNames.map((name) => (
                <span
                  key={name}
                  className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 操作提示 */}
        {isEditing && (
          <div className="absolute bottom-4 right-4 text-xs text-gray-400 bg-white/80 backdrop-blur-sm rounded px-2 py-1" style={{ zIndex: 2 }}>
            {mode === "paint" && t("paint_hint")}
            {mode === "erase" && t("erase_hint")}
            {mode === "label" && t("label_hint")}
            {mode === "camera" && t("camera_hint")}
            {mode === "pan" && t("pan_hint")}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 摄像头属性面板 ──────────────────────────

function CameraPanel({
  camera,
  onUpdate,
  onDelete,
  onClose,
}: {
  camera: CameraMarker;
  onUpdate: (updates: Partial<CameraMarker>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("desktop");

  return (
    <div className="absolute top-4 right-4 w-56 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-20">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">{t("camera_settings")}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ×
        </button>
      </div>

      <label className="block text-xs text-gray-500 mb-1">{t("direction")}</label>
      <input
        type="range" min={0} max={360}
        value={camera.angle}
        onChange={(e) => onUpdate({ angle: Number(e.target.value) })}
        className="w-full mb-1 accent-blue-500"
      />
      <div className="text-xs text-gray-400 text-right mb-2">{camera.angle}°</div>

      <label className="block text-xs text-gray-500 mb-1">{t("fov")}</label>
      <input
        type="range" min={10} max={180}
        value={Math.round((camera.fov * 180) / Math.PI)}
        onChange={(e) => onUpdate({ fov: (Number(e.target.value) * Math.PI) / 180 })}
        className="w-full mb-1 accent-blue-500"
      />
      <div className="text-xs text-gray-400 text-right mb-2">
        {Math.round((camera.fov * 180) / Math.PI)}°
      </div>

      <label className="block text-xs text-gray-500 mb-1">{t("range")}</label>
      <input
        type="range" min={30} max={200}
        value={camera.range}
        onChange={(e) => onUpdate({ range: Number(e.target.value) })}
        className="w-full mb-2 accent-blue-500"
      />

      <Button
        variant="destructive"
        size="sm"
        className="w-full mt-1"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5 mr-1" />
        {t("delete_camera")}
      </Button>
    </div>
  );
}
