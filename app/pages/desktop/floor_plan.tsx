import type { KonvaEventObject } from "konva/lib/Node";
import { Empty } from "antd";
import {
  Camera,
  Hand,
  Layers,
  LayoutTemplate,
  Map as MapIcon,
  MousePointer2,
  Redo2,
  RotateCcw,
  Square,
  Undo2,
  WandSparkles,
  Waypoints,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  Circle,
  Group,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
} from "react-konva";
import { useQuery } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
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
  FloorPlanTemplateId,
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

function clampPointToWorld(point: PlannerPoint): PlannerPoint {
  return {
    x: clamp(point.x, 0, FLOOR_PLAN_WORLD_WIDTH),
    y: clamp(point.y, 0, FLOOR_PLAN_WORLD_HEIGHT),
  };
}

function clientToWorld(
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

function createSectorPoints(camera: CameraMarker) {
  const steps = Math.max(8, Math.ceil(camera.fov / 10));
  const startAngle = camera.angle - camera.fov / 2;
  const endAngle = camera.angle + camera.fov / 2;
  const points = [camera.x, camera.y];

  for (let index = 0; index <= steps; index += 1) {
    const angle = startAngle + ((endAngle - startAngle) * index) / steps;
    const radians = (angle * Math.PI) / 180;
    points.push(
      camera.x + Math.cos(radians) * camera.range,
      camera.y + Math.sin(radians) * camera.range,
    );
  }

  return points;
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
      maxX: FLOOR_PLAN_WORLD_WIDTH * 0.45,
      maxY: FLOOR_PLAN_WORLD_HEIGHT * 0.45,
    };
  }

  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function snapWallEnd(start: PlannerPoint, point: PlannerPoint) {
  const deltaX = point.x - start.x;
  const deltaY = point.y - start.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return { x: point.x, y: start.y };
  }

  return { x: start.x, y: point.y };
}

function normalizeRect(start: PlannerPoint, end: PlannerPoint) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x),
    height: Math.abs(start.y - end.y),
  };
}

function createRectangleWalls(start: PlannerPoint, end: PlannerPoint) {
  const rect = normalizeRect(start, end);
  if (rect.width < FLOOR_PLAN_GRID_SIZE || rect.height < FLOOR_PLAN_GRID_SIZE) {
    return [];
  }

  const topLeft = { x: rect.x, y: rect.y };
  const topRight = { x: rect.x + rect.width, y: rect.y };
  const bottomRight = { x: rect.x + rect.width, y: rect.y + rect.height };
  const bottomLeft = { x: rect.x, y: rect.y + rect.height };

  return createPolygonWalls([topLeft, topRight, bottomRight, bottomLeft]);
}

function createPolygonWalls(points: PlannerPoint[]) {
  if (points.length < 2) {
    return [] as FloorWall[];
  }

  const walls: FloorWall[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    walls.push({
      id: createWallId(),
      x1: current.x,
      y1: current.y,
      x2: next.x,
      y2: next.y,
    });
  }

  return walls;
}

function createPresetWalls(templateId: FloorPlanTemplateId, center: PlannerPoint) {
  const shape: PlannerPoint[] = (() => {
    switch (templateId) {
      case "small_room":
        return [
          { x: 0, y: 0 },
          { x: 400, y: 0 },
          { x: 400, y: 280 },
          { x: 0, y: 280 },
        ];
      case "corridor":
        return [
          { x: 0, y: 0 },
          { x: 760, y: 0 },
          { x: 760, y: 160 },
          { x: 0, y: 160 },
        ];
      case "l_room":
        return [
          { x: 0, y: 0 },
          { x: 520, y: 0 },
          { x: 520, y: 160 },
          { x: 280, y: 160 },
          { x: 280, y: 400 },
          { x: 0, y: 400 },
        ];
      default:
        return [];
    }
  })();

  if (shape.length === 0) {
    return [] as FloorWall[];
  }

  const bounds = {
    minX: Math.min(...shape.map((point) => point.x)),
    minY: Math.min(...shape.map((point) => point.y)),
    maxX: Math.max(...shape.map((point) => point.x)),
    maxY: Math.max(...shape.map((point) => point.y)),
  };

  const offsetX = center.x - (bounds.minX + bounds.maxX) / 2;
  const offsetY = center.y - (bounds.minY + bounds.maxY) / 2;

  return createPolygonWalls(
    shape.map((point) =>
      clampPointToWorld(
        snapPoint({ x: point.x + offsetX, y: point.y + offsetY }),
      ),
    ),
  );
}

function getViewportCenter(view: PlannerView, viewport: { width: number; height: number }) {
  return snapPoint({
    x: (viewport.width / 2 - view.x) / view.scale,
    y: (viewport.height / 2 - view.y) / view.scale,
  });
}

function toolHint(tool: PlannerTool, t: (key: string) => string) {
  switch (tool) {
    case "select":
      return t("select_hint_v2");
    case "wall":
      return t("wall_drag_hint");
    case "room":
      return t("room_drag_hint");
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
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-300"
            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function PresetButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      {label}
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
  const [wallPreview, setWallPreview] = useState<{
    start: PlannerPoint;
    end: PlannerPoint;
  } | null>(null);
  const [roomPreview, setRoomPreview] = useState<{
    start: PlannerPoint;
    end: PlannerPoint;
  } | null>(null);
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
  const wallDrawRef = useRef<{ start: PlannerPoint } | null>(null);
  const roomDrawRef = useRef<{ start: PlannerPoint } | null>(null);
  const dragCameraRef = useRef<
    | {
        cameraId: string;
        moved: boolean;
      }
    | null
  >(null);
  const dragWallRef = useRef<
    | {
        wallId: string;
        startWorld: PlannerPoint;
        origin: FloorWall;
        moved: boolean;
      }
    | null
  >(null);
  const dragWallHandleRef = useRef<
    | {
        wallId: string;
        endpoint: "start" | "end";
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

  const zoomToFit = useCallback(() => {
    const bounds = getPlanBounds(planRef.current);
    const width = Math.max(240, bounds.maxX - bounds.minX + 280);
    const height = Math.max(240, bounds.maxY - bounds.minY + 280);
    const scale = clamp(
      Math.min(viewportSize.width / width, viewportSize.height / height),
      0.35,
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

  const loadHoverEvent = useCallback(
    async (camera: CameraMarker | null) => {
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
    },
    [mutatePlan],
  );

  const insertPreset = useCallback(
    (templateId: FloorPlanTemplateId) => {
      const center = getViewportCenter(planRef.current.view, viewportSize);
      const walls = createPresetWalls(templateId, center);
      if (walls.length === 0) {
        return;
      }
      mutatePlan((draft) => {
        draft.walls.push(...walls);
      });
      setSelection({ type: "wall", id: walls[0].id });
      setTool("select");
    },
    [mutatePlan, viewportSize],
  );

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
        wallDrawRef.current = null;
        roomDrawRef.current = null;
        setWallPreview(null);
        setRoomPreview(null);
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

      if (wallDrawRef.current) {
        const current = clampPointToWorld(
          snapPoint(
            clientToWorld(event.clientX, event.clientY, container, planRef.current.view),
          ),
        );
        setWallPreview({
          start: wallDrawRef.current.start,
          end: snapWallEnd(wallDrawRef.current.start, current),
        });
        return;
      }

      if (roomDrawRef.current) {
        const current = clampPointToWorld(
          snapPoint(
            clientToWorld(event.clientX, event.clientY, container, planRef.current.view),
          ),
        );
        setRoomPreview({ start: roomDrawRef.current.start, end: current });
        return;
      }

      if (dragCameraRef.current) {
        const world = clampPointToWorld(
          snapPoint(
            clientToWorld(event.clientX, event.clientY, container, planRef.current.view),
          ),
        );
        dragCameraRef.current.moved = true;
        mutatePlan((draft) => {
          const camera = draft.cameras.find(
            (item) => item.id === dragCameraRef.current?.cameraId,
          );
          if (!camera) {
            return;
          }
          camera.x = world.x;
          camera.y = world.y;
        }, false);
        return;
      }

      if (dragWallRef.current) {
        const world = clampPointToWorld(
          snapPoint(
            clientToWorld(event.clientX, event.clientY, container, planRef.current.view),
          ),
        );
        const deltaX = world.x - dragWallRef.current.startWorld.x;
        const deltaY = world.y - dragWallRef.current.startWorld.y;
        dragWallRef.current.moved = true;
        mutatePlan((draft) => {
          const wall = draft.walls.find((item) => item.id === dragWallRef.current?.wallId);
          if (!wall) {
            return;
          }
          wall.x1 = clamp(dragWallRef.current.origin.x1 + deltaX, 0, FLOOR_PLAN_WORLD_WIDTH);
          wall.y1 = clamp(dragWallRef.current.origin.y1 + deltaY, 0, FLOOR_PLAN_WORLD_HEIGHT);
          wall.x2 = clamp(dragWallRef.current.origin.x2 + deltaX, 0, FLOOR_PLAN_WORLD_WIDTH);
          wall.y2 = clamp(dragWallRef.current.origin.y2 + deltaY, 0, FLOOR_PLAN_WORLD_HEIGHT);
        }, false);
        return;
      }

      if (dragWallHandleRef.current) {
        const world = clampPointToWorld(
          snapPoint(
            clientToWorld(event.clientX, event.clientY, container, planRef.current.view),
          ),
        );
        dragWallHandleRef.current.moved = true;
        mutatePlan((draft) => {
          const wall = draft.walls.find(
            (item) => item.id === dragWallHandleRef.current?.wallId,
          );
          if (!wall) {
            return;
          }
          if (dragWallHandleRef.current?.endpoint === "start") {
            wall.x1 = world.x;
            wall.y1 = world.y;
          } else {
            wall.x2 = world.x;
            wall.y2 = world.y;
          }
        }, false);
      }
    };

    const handleMouseUp = () => {
      if (panRef.current) {
        panRef.current = null;
      }

      if (wallDrawRef.current) {
        const preview = wallPreview;
        wallDrawRef.current = null;
        setWallPreview(null);
        if (preview && (preview.start.x !== preview.end.x || preview.start.y !== preview.end.y)) {
          const wall: FloorWall = {
            id: createWallId(),
            x1: preview.start.x,
            y1: preview.start.y,
            x2: preview.end.x,
            y2: preview.end.y,
          };
          mutatePlan((draft) => {
            draft.walls.push(wall);
          });
          setSelection({ type: "wall", id: wall.id });
        }
      }

      if (roomDrawRef.current) {
        const preview = roomPreview;
        roomDrawRef.current = null;
        setRoomPreview(null);
        if (preview) {
          const walls = createRectangleWalls(preview.start, preview.end);
          if (walls.length > 0) {
            mutatePlan((draft) => {
              draft.walls.push(...walls);
            });
            setSelection({ type: "wall", id: walls[0].id });
          }
        }
      }

      if (dragCameraRef.current) {
        const moved = dragCameraRef.current.moved;
        dragCameraRef.current = null;
        if (moved) {
          pushHistory(planRef.current);
        }
      }

      if (dragWallRef.current) {
        const moved = dragWallRef.current.moved;
        dragWallRef.current = null;
        if (moved) {
          pushHistory(planRef.current);
        }
      }

      if (dragWallHandleRef.current) {
        const moved = dragWallHandleRef.current.moved;
        dragWallHandleRef.current = null;
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
  }, [mutatePlan, planRef, pushHistory, replacePlan, roomPreview, wallPreview]);

  const beginPan = useCallback((clientX: number, clientY: number) => {
    panRef.current = {
      startX: clientX,
      startY: clientY,
      originX: planRef.current.view.x,
      originY: planRef.current.view.y,
    };
  }, []);

  const handleStageMouseDown = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      if (event.evt.button === 1 || (tool === "pan" && event.evt.button === 0)) {
        event.evt.preventDefault();
        beginPan(event.evt.clientX, event.evt.clientY);
        return;
      }

      if (event.evt.button !== 0) {
        return;
      }

      const worldPoint = clampPointToWorld(
        snapPoint(
          clientToWorld(event.evt.clientX, event.evt.clientY, container, planRef.current.view),
        ),
      );

      if (tool === "camera") {
        const camera = createCameraMarker(worldPoint);
        mutatePlan((draft) => {
          draft.cameras.push(camera);
        });
        setSelection({ type: "camera", id: camera.id });
        return;
      }

      if (tool === "wall") {
        wallDrawRef.current = { start: worldPoint };
        setWallPreview({ start: worldPoint, end: worldPoint });
        return;
      }

      if (tool === "room") {
        roomDrawRef.current = { start: worldPoint };
        setRoomPreview({ start: worldPoint, end: worldPoint });
        return;
      }

      setSelection(null);
    },
    [beginPan, mutatePlan, tool],
  );

  const handleCameraMouseDown = useCallback(
    (cameraId: string, event: KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      if (event.evt.button === 1) {
        event.evt.preventDefault();
        beginPan(event.evt.clientX, event.evt.clientY);
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

  const handleWallMouseDown = useCallback(
    (wall: FloorWall, event: KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      if (event.evt.button === 1) {
        event.evt.preventDefault();
        beginPan(event.evt.clientX, event.evt.clientY);
        return;
      }
      setSelection({ type: "wall", id: wall.id });
      if (tool !== "select") {
        return;
      }

      const container = containerRef.current;
      if (!container) {
        return;
      }

      dragWallRef.current = {
        wallId: wall.id,
        startWorld: clampPointToWorld(
          snapPoint(
            clientToWorld(
              event.evt.clientX,
              event.evt.clientY,
              container,
              planRef.current.view,
            ),
          ),
        ),
        origin: { ...wall },
        moved: false,
      };
    },
    [beginPan, tool],
  );

  const handleWallHandleMouseDown = useCallback(
    (wallId: string, endpoint: "start" | "end", event: KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      if (event.evt.button !== 0) {
        return;
      }
      setSelection({ type: "wall", id: wallId });
      dragWallHandleRef.current = {
        wallId,
        endpoint,
        moved: false,
      };
    },
    [],
  );

  const gridLines = useMemo(() => {
    const left = clamp((-plan.view.x) / plan.view.scale, 0, FLOOR_PLAN_WORLD_WIDTH);
    const top = clamp((-plan.view.y) / plan.view.scale, 0, FLOOR_PLAN_WORLD_HEIGHT);
    const right = clamp(
      (viewportSize.width - plan.view.x) / plan.view.scale,
      0,
      FLOOR_PLAN_WORLD_WIDTH,
    );
    const bottom = clamp(
      (viewportSize.height - plan.view.y) / plan.view.scale,
      0,
      FLOOR_PLAN_WORLD_HEIGHT,
    );

    const lines: Array<{
      key: string;
      points: number[];
      major: boolean;
    }> = [];

    const startColumn = Math.max(0, Math.floor(left / FLOOR_PLAN_GRID_SIZE) - 2);
    const endColumn = Math.min(
      Math.ceil(FLOOR_PLAN_WORLD_WIDTH / FLOOR_PLAN_GRID_SIZE),
      Math.ceil(right / FLOOR_PLAN_GRID_SIZE) + 2,
    );
    const startRow = Math.max(0, Math.floor(top / FLOOR_PLAN_GRID_SIZE) - 2);
    const endRow = Math.min(
      Math.ceil(FLOOR_PLAN_WORLD_HEIGHT / FLOOR_PLAN_GRID_SIZE),
      Math.ceil(bottom / FLOOR_PLAN_GRID_SIZE) + 2,
    );

    for (let column = startColumn; column <= endColumn; column += 1) {
      const x = column * FLOOR_PLAN_GRID_SIZE;
      lines.push({
        key: `vx-${x}`,
        points: [x, 0, x, FLOOR_PLAN_WORLD_HEIGHT],
        major: column % 5 === 0,
      });
    }

    for (let row = startRow; row <= endRow; row += 1) {
      const y = row * FLOOR_PLAN_GRID_SIZE;
      lines.push({
        key: `hy-${y}`,
        points: [0, y, FLOOR_PLAN_WORLD_WIDTH, y],
        major: row % 5 === 0,
      });
    }

    return lines;
  }, [plan.view.scale, plan.view.x, plan.view.y, viewportSize.height, viewportSize.width]);

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
          <ToolbarButton active={tool === "room"} title={t("room_tool")} onClick={() => setTool("room")}>
            <Square className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton active={tool === "camera"} title={t("camera_tool")} onClick={() => setTool("camera")}>
            <Camera className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton active={tool === "pan"} title={t("pan_tool")} onClick={() => setTool("pan")}>
            <Hand className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-6 w-px bg-gray-200" />
          <ToolbarButton disabled={!canUndo} title={t("undo")} onClick={undo}>
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton disabled={!canRedo} title={t("redo")} onClick={redo}>
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title={t("zoom_out")}
            onClick={() =>
              replacePlan(
                {
                  ...plan,
                  view: {
                    ...plan.view,
                    scale: clamp(plan.view.scale - 0.15, 0.35, 3.2),
                  },
                },
                false,
              )
            }
          >
            <ZoomOut className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title={t("zoom_in")}
            onClick={() =>
              replacePlan(
                {
                  ...plan,
                  view: {
                    ...plan.view,
                    scale: clamp(plan.view.scale + 0.15, 0.35, 3.2),
                  },
                },
                false,
              )
            }
          >
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
              setWallPreview(null);
              setRoomPreview(null);
              wallDrawRef.current = null;
              roomDrawRef.current = null;
              replacePlan(next, false);
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <div className="absolute bottom-4 left-4 z-20 max-w-2xl rounded-xl border border-gray-200 bg-white/95 px-4 py-2 text-xs text-gray-600 shadow-sm backdrop-blur">
          {toolHint(tool, t)} · {t("middle_pan_hint")} · {t("preset_hint")}
        </div>

        <div ref={containerRef} className="relative flex-1 overflow-hidden select-none">
          <Stage
            width={viewportSize.width}
            height={viewportSize.height}
            onMouseDown={handleStageMouseDown}
            onContextMenu={(event) => {
              event.evt.preventDefault();
            }}
          >
            <Layer listening={false}>
              <Rect x={0} y={0} width={viewportSize.width} height={viewportSize.height} fill="#f8fafc" />
            </Layer>

            <Layer>
              <Group x={plan.view.x} y={plan.view.y} scaleX={plan.view.scale} scaleY={plan.view.scale}>
                <Rect
                  x={0}
                  y={0}
                  width={FLOOR_PLAN_WORLD_WIDTH}
                  height={FLOOR_PLAN_WORLD_HEIGHT}
                  fill="#ffffff"
                  cornerRadius={20}
                  shadowBlur={6}
                  shadowOpacity={0.04}
                  listening={false}
                />

                {gridLines.map((line) => (
                  <Line
                    key={line.key}
                    points={line.points}
                    stroke={line.major ? "#d9e0ea" : "#edf2f7"}
                    strokeWidth={1}
                    listening={false}
                  />
                ))}

                {roomPreview ? (
                  <Rect
                    x={normalizeRect(roomPreview.start, roomPreview.end).x}
                    y={normalizeRect(roomPreview.start, roomPreview.end).y}
                    width={normalizeRect(roomPreview.start, roomPreview.end).width}
                    height={normalizeRect(roomPreview.start, roomPreview.end).height}
                    dash={[16, 10]}
                    fill="#60a5fa22"
                    stroke="#60a5fa"
                    strokeWidth={4}
                    listening={false}
                  />
                ) : null}

                {wallPreview ? (
                  <Line
                    points={[
                      wallPreview.start.x,
                      wallPreview.start.y,
                      wallPreview.end.x,
                      wallPreview.end.y,
                    ]}
                    stroke="#60a5fa"
                    strokeWidth={4}
                    dash={[16, 10]}
                    lineCap="round"
                    listening={false}
                  />
                ) : null}

                {plan.walls.map((wall) => {
                  const isSelected = selection?.type === "wall" && selection.id === wall.id;
                  return (
                    <Group key={wall.id}>
                      <Line
                        points={[wall.x1, wall.y1, wall.x2, wall.y2]}
                        stroke={isSelected ? "#2563eb" : "#111827"}
                        strokeWidth={isSelected ? 12 : 10}
                        hitStrokeWidth={26}
                        lineCap="round"
                        onMouseDown={(event) => handleWallMouseDown(wall, event)}
                      />

                      {isSelected ? (
                        <>
                          <Circle
                            x={wall.x1}
                            y={wall.y1}
                            radius={9}
                            fill="#ffffff"
                            stroke="#2563eb"
                            strokeWidth={3}
                            onMouseDown={(event) =>
                              handleWallHandleMouseDown(wall.id, "start", event)
                            }
                          />
                          <Circle
                            x={wall.x2}
                            y={wall.y2}
                            radius={9}
                            fill="#ffffff"
                            stroke="#2563eb"
                            strokeWidth={3}
                            onMouseDown={(event) =>
                              handleWallHandleMouseDown(wall.id, "end", event)
                            }
                          />
                        </>
                      ) : null}
                    </Group>
                  );
                })}

                {plan.cameras.map((camera) => {
                  const isSelected = selection?.type === "camera" && selection.id === camera.id;
                  const hasRecentEvent = Boolean(camera.latestEventAt);
                  const accent = camera.channelId ? (hasRecentEvent ? "#f97316" : "#2563eb") : "#9ca3af";
                  const facingX = camera.x + Math.cos((camera.angle * Math.PI) / 180) * 34;
                  const facingY = camera.y + Math.sin((camera.angle * Math.PI) / 180) * 34;

                  return (
                    <Group
                      key={camera.id}
                      onMouseEnter={() => {
                        setHoveredCameraId(camera.id);
                        void loadHoverEvent(camera);
                      }}
                      onMouseLeave={() => {
                        setHoveredCameraId((current) => (current === camera.id ? null : current));
                      }}
                    >
                      <Line
                        points={createSectorPoints(camera)}
                        closed
                        fill={accent}
                        opacity={0.14}
                        stroke={accent}
                        strokeWidth={2}
                        listening={false}
                      />
                      <Line
                        points={[camera.x, camera.y, facingX, facingY]}
                        stroke={accent}
                        strokeWidth={3}
                        listening={false}
                      />
                      <Circle
                        x={camera.x}
                        y={camera.y}
                        radius={isSelected ? 15 : 12}
                        fill={accent}
                        stroke="#ffffff"
                        strokeWidth={3}
                        onMouseDown={(event) => handleCameraMouseDown(camera.id, event)}
                      />
                      <Text
                        x={camera.x + 18}
                        y={camera.y - 16}
                        text={camera.channelName || t("camera_label")}
                        fill="#334155"
                        fontSize={18}
                        fontStyle="bold"
                        listening={false}
                      />
                    </Group>
                  );
                })}
              </Group>
            </Layer>
          </Stage>

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

      <aside className="w-[340px] shrink-0 border-l border-gray-200 bg-white/90 p-4 backdrop-blur">
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

        <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <LayoutTemplate className="h-4 w-4" />
            {t("preset_shapes")}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <PresetButton label={t("preset_small_room")} onClick={() => insertPreset("small_room")} />
            <PresetButton label={t("preset_corridor")} onClick={() => insertPreset("corridor")} />
            <div className="col-span-2">
              <PresetButton label={t("preset_l_room")} onClick={() => insertPreset("l_room")} />
            </div>
          </div>
          <div className="mt-3 text-xs leading-5 text-gray-500">{t("preset_description")}</div>
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
          onAngleChange={(value) =>
            updateSelectedCamera((camera) => {
              camera.angle = value;
            })
          }
          onFovChange={(value) =>
            updateSelectedCamera((camera) => {
              camera.fov = value;
            })
          }
          onRangeChange={(value) =>
            updateSelectedCamera((camera) => {
              camera.range = value;
            })
          }
          onDelete={deleteSelection}
        />

        {selectedCamera ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
            <div className="mb-1 font-medium text-gray-900">{t("camera_summary")}</div>
            <div>
              {t("direction")}: {formatAngle(selectedCamera.angle)}
            </div>
            <div>
              {t("fov")}: {Math.round(selectedCamera.fov)}°
            </div>
            <div>
              {t("range")}: {Math.round(selectedCamera.range)}
            </div>
          </div>
        ) : selectedWall ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <div className="mb-1 font-medium text-gray-900">{t("wall_selected")}</div>
            <div className="mb-2 text-xs text-gray-500">#{selectedWall.id}</div>
            <div className="mb-3 text-xs leading-5 text-gray-500">{t("wall_edit_tip")}</div>
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
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("selection_empty_description_v2")} />
          </div>
        )}
      </aside>
    </div>
  );
}
