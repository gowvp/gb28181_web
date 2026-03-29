import { useQuery } from "@tanstack/react-query";
import { Empty } from "antd";
import {
  Camera,
  Hand,
  Layers,
  Map as MapIcon,
  MousePointer2,
  Redo2,
  RotateCcw,
  Undo2,
  WandSparkles,
  Waypoints,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { CameraBindingPanel } from "~/components/desktop/camera-binding-panel";
import { CameraHoverCard } from "~/components/desktop/camera-hover-card";
import {
  FlattenDeviceChannels,
  FindDevicesChannels,
  findDevicesChannelsKey,
} from "~/service/api/device/device";
import {
  FLOOR_PLAN_GRID_SIZE,
  FLOOR_PLAN_WORLD_HEIGHT,
  FLOOR_PLAN_WORLD_WIDTH,
  clearFloorPlanState,
  cloneFloorPlanState,
  createCameraMarker,
  createDefaultFloorPlanState,
  loadFloorPlanState,
  normalizeFloorPlanState,
  saveFloorPlanState,
} from "./floor_plan.storage";
import { getLatestCameraEvent } from "./floor_plan.events";
import type {
  CameraMarker,
  FloorPlanState,
  FloorWall,
  LatestCameraEvent,
  PlannerPoint,
  PlannerSelection,
  PlannerTool,
  PlannerView,
} from "./floor_plan.types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createWallId() {
  return `wall-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function snapPoint(point: PlannerPoint): PlannerPoint {
  return {
    x: Math.round(point.x / FLOOR_PLAN_GRID_SIZE) * FLOOR_PLAN_GRID_SIZE,
    y: Math.round(point.y / FLOOR_PLAN_GRID_SIZE) * FLOOR_PLAN_GRID_SIZE,
  };
}

function screenToWorld(
  clientX: number,
  clientY: number,
  container: HTMLDivElement,
  view: PlannerView,
): PlannerPoint {
  const rect = container.getBoundingClientRect();
  return {
    x: (clientX - rect.left - view.x) / view.scale,
    y: (clientY - rect.top - view.y) / view.scale,
  };
}

function worldToScreen(point: PlannerPoint, view: PlannerView): PlannerPoint {
  return {
    x: point.x * view.scale + view.x,
    y: point.y * view.scale + view.y,
  };
}

function formatAngle(angle: number) {
  return `${Math.round(angle)}°`;
}

function createSectorPath(camera: CameraMarker) {
  const startAngle = ((camera.angle - camera.fov / 2) * Math.PI) / 180;
  const endAngle = ((camera.angle + camera.fov / 2) * Math.PI) / 180;
  const startX = camera.x + Math.cos(startAngle) * camera.range;
  const startY = camera.y + Math.sin(startAngle) * camera.range;
  const endX = camera.x + Math.cos(endAngle) * camera.range;
  const endY = camera.y + Math.sin(endAngle) * camera.range;
  const largeArc = camera.fov > 180 ? 1 : 0;

  return `M ${camera.x} ${camera.y} L ${startX} ${startY} A ${camera.range} ${camera.range} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

function getPlanBounds(plan: FloorPlanState) {
  const points: PlannerPoint[] = [];
  for (const wall of plan.walls) {
    points.push({ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 });
  }
  for (const camera of plan.cameras) {
    points.push({ x: camera.x, y: camera.y });
  }

  if (points.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: FLOOR_PLAN_WORLD_WIDTH * 0.6,
      maxY: FLOOR_PLAN_WORLD_HEIGHT * 0.5,
    };
  }

  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function toolHint(tool: PlannerTool, t: (key: string) => string) {
  switch (tool) {
    case "select":
      return t("select_hint");
    case "wall":
      return t("wall_hint");
    case "camera":
      return t("camera_place_hint");
    case "pan":
      return t("pan_hint_v2");
    default:
      return "";
  }
}

function ToolbarButton({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

interface FloorPlanEditorProps {
  viewMode: "dataflow" | "2d";
  onViewModeChange: (mode: "dataflow" | "2d") => void;
}

export default function FloorPlanEditor({ onViewModeChange }: FloorPlanEditorProps) {
  const { t } = useTranslation("desktop");

  const initialPlan = useMemo(
    () => loadFloorPlanState() ?? createDefaultFloorPlanState(),
    [],
  );

  const [plan, setPlan] = useState<FloorPlanState>(initialPlan);
  const planRef = useRef<FloorPlanState>(initialPlan);
  const [tool, setTool] = useState<PlannerTool>("select");
  const [selection, setSelection] = useState<PlannerSelection>(null);
  const [pendingWallStart, setPendingWallStart] = useState<PlannerPoint | null>(null);
  const [wallPreviewPoint, setWallPreviewPoint] = useState<PlannerPoint | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 800 });
  const [historyVersion, setHistoryVersion] = useState(0);
  const [hoveredCameraId, setHoveredCameraId] = useState<string | null>(null);
  const [hoverEvent, setHoverEvent] = useState<LatestCameraEvent | null>(null);
  const [hoverLoading, setHoverLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<FloorPlanState[]>([cloneFloorPlanState(initialPlan)]);
  const historyIndexRef = useRef(0);
  const panRef = useRef<
    | {
        startX: number;
        startY: number;
        originX: number;
        originY: number;
      }
    | null
  >(null);
  const dragCameraRef = useRef<
    | {
        cameraId: string;
        moved: boolean;
      }
    | null
  >(null);

  useEffect(() => {
    planRef.current = plan;
    saveFloorPlanState(plan);
  }, [plan]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) {
        return;
      }
      setViewportSize({ width: rect.width, height: rect.height });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const channelQuery = useQuery({
    queryKey: [findDevicesChannelsKey, "floor-plan"],
    queryFn: () => FindDevicesChannels({ page: 1, size: 500 }),
    staleTime: 30_000,
  });

  const channelOptions = useMemo(
    () => FlattenDeviceChannels(channelQuery.data?.data.items ?? []),
    [channelQuery.data?.data.items],
  );

  const selectedCamera = useMemo(() => {
    if (selection?.type !== "camera") {
      return null;
    }
    return plan.cameras.find((camera) => camera.id === selection.id) ?? null;
  }, [plan.cameras, selection]);

  const selectedWall = useMemo(() => {
    if (selection?.type !== "wall") {
      return null;
    }
    return plan.walls.find((wall) => wall.id === selection.id) ?? null;
  }, [plan.walls, selection]);

  const hoveredCamera = useMemo(() => {
    if (!hoveredCameraId) {
      return null;
    }
    return plan.cameras.find((camera) => camera.id === hoveredCameraId) ?? null;
  }, [hoveredCameraId, plan.cameras]);

  const hoveredCameraScreenPosition = useMemo(() => {
    if (!hoveredCamera) {
      return null;
    }
    return worldToScreen({ x: hoveredCamera.x, y: hoveredCamera.y }, plan.view);
  }, [hoveredCamera, plan.view]);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  const pushHistory = useCallback((next: FloorPlanState) => {
    const normalized = cloneFloorPlanState(normalizeFloorPlanState(next));
    const base = historyRef.current.slice(0, historyIndexRef.current + 1);
    base.push(normalized);
    if (base.length > 80) {
      base.shift();
    }
    historyRef.current = base;
    historyIndexRef.current = base.length - 1;
    setHistoryVersion((value) => value + 1);
  }, []);

  const replacePlan = useCallback(
    (next: FloorPlanState, commit = true) => {
      const normalized = normalizeFloorPlanState({
        ...next,
        updatedAt: Date.now(),
      });
      planRef.current = normalized;
      setPlan(normalized);
      if (commit) {
        pushHistory(normalized);
      }
    },
    [pushHistory],
  );

  const mutatePlan = useCallback(
    (recipe: (draft: FloorPlanState) => void, commit = true) => {
      const draft = cloneFloorPlanState(planRef.current);
      recipe(draft);
      draft.updatedAt = Date.now();
      replacePlan(draft, commit);
    },
    [replacePlan],
  );

  const resetView = useCallback(() => {
    const next = cloneFloorPlanState(planRef.current);
    next.view = createDefaultFloorPlanState().view;
    replacePlan(next, false);
  }, [replacePlan]);

  const zoomToFit = useCallback(() => {
    const bounds = getPlanBounds(planRef.current);
    const width = Math.max(240, bounds.maxX - bounds.minX + 280);
    const height = Math.max(240, bounds.maxY - bounds.minY + 280);
    const scale = clamp(
      Math.min(viewportSize.width / width, viewportSize.height / height),
      0.4,
      2.4,
    );

    replacePlan(
      {
        ...planRef.current,
        view: {
          scale,
          x: viewportSize.width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
          y: viewportSize.height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
        },
      },
      false,
    );
  }, [replacePlan, viewportSize.height, viewportSize.width]);

  const updateSelectedCamera = useCallback(
    (recipe: (camera: CameraMarker) => void, commit = true) => {
      if (!selectedCamera) {
        return;
      }
      mutatePlan((draft) => {
        const camera = draft.cameras.find((item) => item.id === selectedCamera.id);
        if (!camera) {
          return;
        }
        recipe(camera);
      }, commit);
    },
    [mutatePlan, selectedCamera],
  );

  const deleteSelection = useCallback(() => {
    if (!selection) {
      return;
    }
    mutatePlan((draft) => {
      if (selection.type === "camera") {
        draft.cameras = draft.cameras.filter((camera) => camera.id !== selection.id);
      } else {
        draft.walls = draft.walls.filter((wall) => wall.id !== selection.id);
      }
    });
    setSelection(null);
  }, [mutatePlan, selection]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) {
      return;
    }
    historyIndexRef.current -= 1;
    const snapshot = cloneFloorPlanState(historyRef.current[historyIndexRef.current]);
    planRef.current = snapshot;
    setPlan(snapshot);
    setHistoryVersion((value) => value + 1);
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) {
      return;
    }
    historyIndexRef.current += 1;
    const snapshot = cloneFloorPlanState(historyRef.current[historyIndexRef.current]);
    planRef.current = snapshot;
    setPlan(snapshot);
    setHistoryVersion((value) => value + 1);
  }, []);

  const loadHoverEvent = useCallback(async (camera: CameraMarker | null) => {
    if (!camera?.channelId) {
      setHoverEvent(null);
      setHoverLoading(false);
      return;
    }

    setHoverEvent(null);
    setHoverLoading(true);
    const latest = await getLatestCameraEvent(camera.channelId);
    setHoverEvent(latest);
    setHoverLoading(false);

    if (!latest) {
      return;
    }

    mutatePlan((draft) => {
      const target = draft.cameras.find((item) => item.id === camera.id);
      if (!target) {
        return;
      }
      target.latestEventAt = latest.startedAt;
      target.latestEventImage = latest.imageSrc;
      target.latestEventLabel = latest.label;
      target.latestEventScore = latest.score;
    }, false);
  }, [mutatePlan]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.ctrlKey || event.metaKey;

      if (isMeta && event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
        return;
      }

      if (isMeta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
        return;
      }

      if (isMeta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelection();
        return;
      }

      if (event.key === "Escape") {
        setPendingWallStart(null);
        setWallPreviewPoint(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelection, redo, undo]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      if (panRef.current) {
        const deltaX = event.clientX - panRef.current.startX;
        const deltaY = event.clientY - panRef.current.startY;
        replacePlan(
          {
            ...planRef.current,
            view: {
              ...planRef.current.view,
              x: panRef.current.originX + deltaX,
              y: panRef.current.originY + deltaY,
            },
          },
          false,
        );
        return;
      }

      if (dragCameraRef.current) {
        const world = snapPoint(screenToWorld(event.clientX, event.clientY, container, planRef.current.view));
        dragCameraRef.current.moved = true;
        mutatePlan((draft) => {
          const camera = draft.cameras.find((item) => item.id === dragCameraRef.current?.cameraId);
          if (!camera) {
            return;
          }
          camera.x = world.x;
          camera.y = world.y;
        }, false);
      }
    };

    const handleMouseUp = () => {
      if (panRef.current) {
        panRef.current = null;
      }
      if (dragCameraRef.current) {
        const moved = dragCameraRef.current.moved;
        dragCameraRef.current = null;
        if (moved) {
          pushHistory(planRef.current);
        }
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [mutatePlan, pushHistory, replacePlan]);

  const beginPan = useCallback((clientX: number, clientY: number) => {
    panRef.current = {
      startX: clientX,
      startY: clientY,
      originX: planRef.current.view.x,
      originY: planRef.current.view.y,
    };
  }, []);

  const handleCanvasMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      if (event.button === 1 || (tool === "pan" && event.button === 0)) {
        event.preventDefault();
        beginPan(event.clientX, event.clientY);
        return;
      }

      if (event.button !== 0) {
        return;
      }

      const worldPoint = snapPoint(screenToWorld(event.clientX, event.clientY, container, plan.view));

      if (tool === "camera") {
        const camera = createCameraMarker(worldPoint);
        mutatePlan((draft) => {
          draft.cameras.push(camera);
        });
        setSelection({ type: "camera", id: camera.id });
        return;
      }

      if (tool === "wall") {
        if (!pendingWallStart) {
          setPendingWallStart(worldPoint);
          setWallPreviewPoint(worldPoint);
          return;
        }

        if (pendingWallStart.x === worldPoint.x && pendingWallStart.y === worldPoint.y) {
          return;
        }

        const wall: FloorWall = {
          id: createWallId(),
          x1: pendingWallStart.x,
          y1: pendingWallStart.y,
          x2: worldPoint.x,
          y2: worldPoint.y,
        };
        mutatePlan((draft) => {
          draft.walls.push(wall);
        });
        setSelection({ type: "wall", id: wall.id });
        setPendingWallStart(worldPoint);
        setWallPreviewPoint(worldPoint);
        return;
      }

      setSelection(null);
    },
    [beginPan, mutatePlan, pendingWallStart, plan.view, tool],
  );

  const handleCanvasMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!pendingWallStart || tool !== "wall") {
        return;
      }
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const worldPoint = snapPoint(screenToWorld(event.clientX, event.clientY, container, plan.view));
      setWallPreviewPoint(worldPoint);
    },
    [pendingWallStart, plan.view, tool],
  );

  const handleCameraMouseDown = useCallback(
    (cameraId: string, event: ReactMouseEvent<SVGCircleElement>) => {
      event.stopPropagation();
      if (event.button === 1) {
        event.preventDefault();
        beginPan(event.clientX, event.clientY);
        return;
      }
      setSelection({ type: "camera", id: cameraId });
      if (tool !== "select") {
        return;
      }
      dragCameraRef.current = {
        cameraId,
        moved: false,
      };
    },
    [beginPan, tool],
  );

  const gridLines = useMemo(() => {
    const lines: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }> = [];
    for (let x = 0; x <= FLOOR_PLAN_WORLD_WIDTH; x += FLOOR_PLAN_GRID_SIZE) {
      lines.push({ key: `vx-${x}`, x1: x, y1: 0, x2: x, y2: FLOOR_PLAN_WORLD_HEIGHT });
    }
    for (let y = 0; y <= FLOOR_PLAN_WORLD_HEIGHT; y += FLOOR_PLAN_GRID_SIZE) {
      lines.push({ key: `hy-${y}`, x1: 0, y1: y, x2: FLOOR_PLAN_WORLD_WIDTH, y2: y });
    }
    return lines;
  }, []);

  void historyVersion;

  return (
    <div className="flex h-full min-h-screen bg-[#f5f7fb] text-gray-900">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-xl border border-gray-200 bg-white/95 p-2 shadow-sm backdrop-blur">
          <ToolbarButton title={t("dataflow")} onClick={() => onViewModeChange("dataflow")}>
            <Layers className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton active title={t("floor_plan_mode")} onClick={() => onViewModeChange("2d")}>
            <MapIcon className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-6 w-px bg-gray-200" />
          <ToolbarButton active={tool === "select"} title={t("select_tool")} onClick={() => setTool("select")}>
            <MousePointer2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton active={tool === "wall"} title={t("wall_tool")} onClick={() => setTool("wall")}>
            <Waypoints className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton active={tool === "camera"} title={t("camera_tool")} onClick={() => setTool("camera")}>
            <Camera className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton active={tool === "pan"} title={t("pan_tool")} onClick={() => setTool("pan")}>
            <Hand className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-6 w-px bg-gray-200" />
          <ToolbarButton title={t("undo")} onClick={undo}>
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title={t("redo")} onClick={redo}>
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title={t("zoom_out")} onClick={() => replacePlan({ ...plan, view: { ...plan.view, scale: clamp(plan.view.scale - 0.15, 0.35, 3.2) } }, false)}>
            <ZoomOut className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title={t("zoom_in")} onClick={() => replacePlan({ ...plan, view: { ...plan.view, scale: clamp(plan.view.scale + 0.15, 0.35, 3.2) } }, false)}>
            <ZoomIn className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title={t("zoom_to_fit")} onClick={zoomToFit}>
            <WandSparkles className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title={t("reset_layout")}
            onClick={() => {
              clearFloorPlanState();
              const next = createDefaultFloorPlanState();
              historyRef.current = [cloneFloorPlanState(next)];
              historyIndexRef.current = 0;
              setHistoryVersion((value) => value + 1);
              setSelection(null);
              setPendingWallStart(null);
              setWallPreviewPoint(null);
              replacePlan(next, false);
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <div className="absolute bottom-4 left-4 z-20 max-w-xl rounded-xl border border-gray-200 bg-white/95 px-4 py-2 text-xs text-gray-600 shadow-sm backdrop-blur">
          {toolHint(tool, t)} · {t("middle_pan_hint")} · {t("double_click_finish_wall")}
        </div>

        <div
          ref={containerRef}
          className="relative flex-1 overflow-hidden"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onDoubleClick={() => {
            setPendingWallStart(null);
            setWallPreviewPoint(null);
          }}
          onContextMenu={(event) => {
            if (tool === "wall") {
              event.preventDefault();
              setPendingWallStart(null);
              setWallPreviewPoint(null);
            }
          }}
        >
          <svg className="h-full w-full select-none" style={{ cursor: tool === "pan" ? "grab" : "default" }}>
            <rect x={0} y={0} width={viewportSize.width} height={viewportSize.height} fill="#f8fafc" />
            <g transform={`translate(${plan.view.x} ${plan.view.y}) scale(${plan.view.scale})`}>
              <rect x={0} y={0} width={FLOOR_PLAN_WORLD_WIDTH} height={FLOOR_PLAN_WORLD_HEIGHT} fill="#ffffff" rx={16} ry={16} />
              {gridLines.map((line) => (
                <line
                  key={line.key}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                />
              ))}

              {plan.walls.map((wall) => {
                const isSelected = selection?.type === "wall" && selection.id === wall.id;
                return (
                  <line
                    key={wall.id}
                    x1={wall.x1}
                    y1={wall.y1}
                    x2={wall.x2}
                    y2={wall.y2}
                    stroke={isSelected ? "#2563eb" : "#111827"}
                    strokeWidth={isSelected ? 12 : 10}
                    strokeLinecap="round"
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      setSelection({ type: "wall", id: wall.id });
                    }}
                  />
                );
              })}

              {pendingWallStart && wallPreviewPoint ? (
                <line
                  x1={pendingWallStart.x}
                  y1={pendingWallStart.y}
                  x2={wallPreviewPoint.x}
                  y2={wallPreviewPoint.y}
                  stroke="#60a5fa"
                  strokeWidth={4}
                  strokeDasharray="10 8"
                  strokeLinecap="round"
                />
              ) : null}

              {plan.cameras.map((camera) => {
                const isSelected = selection?.type === "camera" && selection.id === camera.id;
                const hasRecentEvent = Boolean(camera.latestEventAt);
                const accent = camera.channelId ? (hasRecentEvent ? "#f97316" : "#2563eb") : "#9ca3af";
                const facingX = camera.x + Math.cos((camera.angle * Math.PI) / 180) * 30;
                const facingY = camera.y + Math.sin((camera.angle * Math.PI) / 180) * 30;
                return (
                  <g
                    key={camera.id}
                    onMouseEnter={() => {
                      setHoveredCameraId(camera.id);
                      void loadHoverEvent(camera);
                    }}
                    onMouseLeave={() => {
                      setHoveredCameraId((current) => (current === camera.id ? null : current));
                    }}
                  >
                    <path d={createSectorPath(camera)} fill={accent} opacity={0.14} stroke={accent} strokeWidth={2} />
                    <line x1={camera.x} y1={camera.y} x2={facingX} y2={facingY} stroke={accent} strokeWidth={3} />
                    <circle
                      cx={camera.x}
                      cy={camera.y}
                      r={isSelected ? 15 : 12}
                      fill={accent}
                      stroke="#ffffff"
                      strokeWidth={3}
                      onMouseDown={(event) => handleCameraMouseDown(camera.id, event)}
                    />
                    <text
                      x={camera.x + 16}
                      y={camera.y - 14}
                      fill="#334155"
                      fontSize={18}
                      fontWeight={600}
                    >
                      {camera.channelName || t("camera_label")}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {hoveredCamera && hoveredCameraScreenPosition ? (
            <CameraHoverCard
              camera={hoveredCamera}
              latestEvent={hoverEvent}
              loading={hoverLoading}
              x={hoveredCameraScreenPosition.x + 18}
              y={hoveredCameraScreenPosition.y + 18}
            />
          ) : null}
        </div>
      </div>

      <aside className="w-[320px] shrink-0 border-l border-gray-200 bg-white/90 p-4 backdrop-blur">
        <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 text-sm font-semibold text-gray-900">{t("planner_overview")}</div>
          <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <div className="text-xs text-gray-500">{t("wall_count")}</div>
              <div className="mt-1 text-xl font-semibold text-gray-900">{plan.walls.length}</div>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <div className="text-xs text-gray-500">{t("camera_count")}</div>
              <div className="mt-1 text-xl font-semibold text-gray-900">{plan.cameras.length}</div>
            </div>
            <div className="col-span-2 rounded-xl bg-white p-3 shadow-sm text-xs text-gray-500">
              {t("current_scale")}: {(plan.view.scale * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        <CameraBindingPanel
          camera={selectedCamera}
          channelOptions={channelOptions}
          channelsLoading={channelQuery.isLoading}
          onBindChannel={(channelId) => {
            updateSelectedCamera((camera) => {
              const option = channelOptions.find((item) => item.value === channelId);
              camera.channelId = channelId;
              camera.channelName = option?.channelName ?? null;
              camera.deviceName = option?.deviceName ?? null;
            });
          }}
          onAngleChange={(value) => updateSelectedCamera((camera) => { camera.angle = value; })}
          onFovChange={(value) => updateSelectedCamera((camera) => { camera.fov = value; })}
          onRangeChange={(value) => updateSelectedCamera((camera) => { camera.range = value; })}
          onDelete={deleteSelection}
        />

        {selectedCamera ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
            <div className="mb-1 font-medium text-gray-900">{t("camera_summary")}</div>
            <div>{t("direction")}: {formatAngle(selectedCamera.angle)}</div>
            <div>{t("fov")}: {Math.round(selectedCamera.fov)}°</div>
            <div>{t("range")}: {Math.round(selectedCamera.range)}</div>
          </div>
        ) : selectedWall ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <div className="mb-1 font-medium text-gray-900">{t("wall_selected")}</div>
            <div className="mb-3 text-xs text-gray-500">#{selectedWall.id}</div>
            <button
              type="button"
              onClick={deleteSelection}
              className="inline-flex w-full items-center justify-center rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
            >
              {t("delete_wall")}
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("selection_empty_description")} />
          </div>
        )}
      </aside>
    </div>
  );
}
