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

function createGroupId() {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

function createSelection(wallIds: string[] = [], cameraIds: string[] = []): PlannerSelection {
  const walls = uniqueIds(wallIds);
  const cameras = uniqueIds(cameraIds);
  if (walls.length === 0 && cameras.length === 0) {
    return null;
  }
  return {
    wallIds: walls,
    cameraIds: cameras,
  };
}

function selectionCount(selection: PlannerSelection) {
  if (!selection) {
    return 0;
  }
  return selection.wallIds.length + selection.cameraIds.length;
}

function isEntitySelected(
  selection: PlannerSelection,
  entityType: "wall" | "camera",
  entityId: string,
) {
  if (!selection) {
    return false;
  }
  return entityType === "wall"
    ? selection.wallIds.includes(entityId)
    : selection.cameraIds.includes(entityId);
}

function toggleEntitySelection(
  selection: PlannerSelection,
  entityType: "wall" | "camera",
  entityId: string,
) {
  if (entityType === "wall") {
    const next = selection?.wallIds.includes(entityId)
      ? (selection?.wallIds ?? []).filter((id) => id !== entityId)
      : [...(selection?.wallIds ?? []), entityId];
    return createSelection(next, selection?.cameraIds ?? []);
  }

  const next = selection?.cameraIds.includes(entityId)
    ? (selection?.cameraIds ?? []).filter((id) => id !== entityId)
    : [...(selection?.cameraIds ?? []), entityId];
  return createSelection(selection?.wallIds ?? [], next);
}

function getEntityGroupId(
  plan: FloorPlanState,
  entityType: "wall" | "camera",
  entityId: string,
) {
  if (entityType === "wall") {
    return plan.walls.find((wall) => wall.id === entityId)?.groupId ?? null;
  }
  return plan.cameras.find((camera) => camera.id === entityId)?.groupId ?? null;
}

function selectEntity(plan: FloorPlanState, entityType: "wall" | "camera", entityId: string) {
  const groupId = getEntityGroupId(plan, entityType, entityId);
  if (!groupId) {
    return entityType === "wall"
      ? createSelection([entityId], [])
      : createSelection([], [entityId]);
  }

  return createSelection(
    plan.walls.filter((wall) => wall.groupId === groupId).map((wall) => wall.id),
    plan.cameras.filter((camera) => camera.groupId === groupId).map((camera) => camera.id),
  );
}

function getSelectionGroupIds(plan: FloorPlanState, selection: PlannerSelection) {
  if (!selection) {
    return [] as string[];
  }

  const ids = [
    ...plan.walls
      .filter((wall) => selection.wallIds.includes(wall.id) && wall.groupId)
      .map((wall) => wall.groupId as string),
    ...plan.cameras
      .filter((camera) => selection.cameraIds.includes(camera.id) && camera.groupId)
      .map((camera) => camera.groupId as string),
  ];

  return uniqueIds(ids);
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

function normalizeMarqueeRect(start: PlannerPoint, end: PlannerPoint) {
  const rect = normalizeRect(start, end);
  return {
    ...rect,
    x2: rect.x + rect.width,
    y2: rect.y + rect.height,
  };
}

function pointInRect(point: PlannerPoint, rect: ReturnType<typeof normalizeMarqueeRect>) {
  return point.x >= rect.x && point.x <= rect.x2 && point.y >= rect.y && point.y <= rect.y2;
}

function lineSegmentsIntersect(a: PlannerPoint, b: PlannerPoint, c: PlannerPoint, d: PlannerPoint) {
  const direction = (p1: PlannerPoint, p2: PlannerPoint, p3: PlannerPoint) =>
    (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
  const onSegment = (p1: PlannerPoint, p2: PlannerPoint, p3: PlannerPoint) =>
    Math.min(p1.x, p2.x) <= p3.x &&
    p3.x <= Math.max(p1.x, p2.x) &&
    Math.min(p1.y, p2.y) <= p3.y &&
    p3.y <= Math.max(p1.y, p2.y);

  const d1 = direction(c, d, a);
  const d2 = direction(c, d, b);
  const d3 = direction(a, b, c);
  const d4 = direction(a, b, d);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  if (d1 === 0 && onSegment(c, d, a)) {
    return true;
  }
  if (d2 === 0 && onSegment(c, d, b)) {
    return true;
  }
  if (d3 === 0 && onSegment(a, b, c)) {
    return true;
  }
  if (d4 === 0 && onSegment(a, b, d)) {
    return true;
  }

  return false;
}

function lineIntersectsRect(
  start: PlannerPoint,
  end: PlannerPoint,
  rect: ReturnType<typeof normalizeMarqueeRect>,
) {
  if (pointInRect(start, rect) || pointInRect(end, rect)) {
    return true;
  }

  if (
    Math.max(start.x, end.x) < rect.x ||
    Math.min(start.x, end.x) > rect.x2 ||
    Math.max(start.y, end.y) < rect.y ||
    Math.min(start.y, end.y) > rect.y2
  ) {
    return false;
  }

  const topLeft = { x: rect.x, y: rect.y };
  const topRight = { x: rect.x2, y: rect.y };
  const bottomRight = { x: rect.x2, y: rect.y2 };
  const bottomLeft = { x: rect.x, y: rect.y2 };

  return [
    [topLeft, topRight],
    [topRight, bottomRight],
    [bottomRight, bottomLeft],
    [bottomLeft, topLeft],
  ].some(([edgeStart, edgeEnd]) => lineSegmentsIntersect(start, end, edgeStart, edgeEnd));
}

function selectionFromRect(plan: FloorPlanState, start: PlannerPoint, end: PlannerPoint) {
  const rect = normalizeMarqueeRect(start, end);
  if (rect.width < 6 && rect.height < 6) {
    return null;
  }

  return createSelection(
    plan.walls
      .filter((wall) =>
        lineIntersectsRect(
          { x: wall.x1, y: wall.y1 },
          { x: wall.x2, y: wall.y2 },
          rect,
        ),
      )
      .map((wall) => wall.id),
    plan.cameras
      .filter((camera) => pointInRect({ x: camera.x, y: camera.y }, rect))
      .map((camera) => camera.id),
  );
}

function mergeSelections(base: PlannerSelection, addition: PlannerSelection) {
  return createSelection(
    [...(base?.wallIds ?? []), ...(addition?.wallIds ?? [])],
    [...(base?.cameraIds ?? []), ...(addition?.cameraIds ?? [])],
  );
}

function constrainDragDelta(deltaX: number, deltaY: number, constrained: boolean) {
  if (!constrained) {
    return { deltaX, deltaY };
  }

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return { deltaX, deltaY: 0 };
  }

  return { deltaX: 0, deltaY };
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
      groupId: null,
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

function CompactActionButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center rounded-lg border px-3 text-xs font-semibold transition-colors ${
        disabled
          ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-300"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
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
  const selectionRef = useRef<PlannerSelection>(null);
  const [wallPreview, setWallPreview] = useState<{
    start: PlannerPoint;
    end: PlannerPoint;
  } | null>(null);
  const [roomPreview, setRoomPreview] = useState<{
    start: PlannerPoint;
    end: PlannerPoint;
  } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
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
  const marqueeRef = useRef<
    | {
        start: PlannerPoint;
        current: PlannerPoint;
        additive: boolean;
      }
    | null
  >(null);
  const dragSelectionRef = useRef<
    | {
        wallIds: string[];
        cameraIds: string[];
        startWorld: PlannerPoint;
        moved: boolean;
        bounds: {
          minX: number;
          maxX: number;
          minY: number;
          maxY: number;
        };
        wallOrigins: Record<string, FloorWall>;
        cameraOrigins: Record<string, { x: number; y: number }>;
      }
    | null
  >(null);
  const dragWallHandleRef = useRef<
    | {
        wallId: string;
        endpoint: "start" | "end";
        moved: boolean;
        anchor: PlannerPoint;
      }
    | null
  >(null);

  useEffect(() => {
    planRef.current = plan;
    saveFloorPlanState(plan);
  }, [plan]);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

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
    if (!selection || selection.cameraIds.length !== 1 || selection.wallIds.length > 0) {
      return null;
    }
    return plan.cameras.find((camera) => camera.id === selection.cameraIds[0]) ?? null;
  }, [plan.cameras, selection]);

  const selectedWall = useMemo(() => {
    if (!selection || selection.wallIds.length !== 1 || selection.cameraIds.length > 0) {
      return null;
    }
    return plan.walls.find((wall) => wall.id === selection.wallIds[0]) ?? null;
  }, [plan.walls, selection]);

  const selectedWallCount = selection?.wallIds.length ?? 0;
  const selectedCameraCount = selection?.cameraIds.length ?? 0;
  const selectedTotal = selectionCount(selection);
  const isBatchSelection = selectedTotal > 1 || (selectedWallCount > 0 && selectedCameraCount > 0);

  const selectedGroupIds = useMemo(
    () => getSelectionGroupIds(plan, selection),
    [plan, selection],
  );

  const canGroup = selectedTotal > 1;
  const canUngroup = selectedGroupIds.length > 0;

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
    const currentSelection = selectionRef.current;
    if (!currentSelection) {
      return;
    }
    mutatePlan((draft) => {
      draft.cameras = draft.cameras.filter(
        (camera) => !currentSelection.cameraIds.includes(camera.id),
      );
      draft.walls = draft.walls.filter((wall) => !currentSelection.wallIds.includes(wall.id));
    });
    setSelection(null);
  }, [mutatePlan]);

  const groupSelection = useCallback(() => {
    const currentSelection = selectionRef.current;
    if (selectionCount(currentSelection) < 2) {
      return;
    }
    const groupId = createGroupId();
    mutatePlan((draft) => {
      draft.walls.forEach((wall) => {
        if (currentSelection?.wallIds.includes(wall.id)) {
          wall.groupId = groupId;
        }
      });
      draft.cameras.forEach((camera) => {
        if (currentSelection?.cameraIds.includes(camera.id)) {
          camera.groupId = groupId;
        }
      });
    });
  }, [mutatePlan]);

  const ungroupSelection = useCallback(() => {
    const currentSelection = selectionRef.current;
    if (!currentSelection) {
      return;
    }
    mutatePlan((draft) => {
      draft.walls.forEach((wall) => {
        if (currentSelection.wallIds.includes(wall.id)) {
          wall.groupId = null;
        }
      });
      draft.cameras.forEach((camera) => {
        if (currentSelection.cameraIds.includes(camera.id)) {
          camera.groupId = null;
        }
      });
    });
  }, [mutatePlan]);



  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) {
      return;
    }
    historyIndexRef.current -= 1;
    const snapshot = cloneFloorPlanState(historyRef.current[historyIndexRef.current]);
    planRef.current = snapshot;
    setPlan(snapshot);
    setSelection(null);
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
    setSelection(null);
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
      setSelection(createSelection(walls.map((wall) => wall.id), []));
      setTool("select");
    },
    [mutatePlan, viewportSize],
  );



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

      if (marqueeRef.current) {
        const current = clampPointToWorld(
          snapPoint(
            clientToWorld(event.clientX, event.clientY, container, planRef.current.view),
          ),
        );
        marqueeRef.current.current = current;
        const rect = normalizeRect(marqueeRef.current.start, current);
        setMarqueeRect(rect);
        return;
      }

      if (dragSelectionRef.current) {
        const world = clampPointToWorld(
          snapPoint(
            clientToWorld(event.clientX, event.clientY, container, planRef.current.view),
          ),
        );
        const rawDeltaX = world.x - dragSelectionRef.current.startWorld.x;
        const rawDeltaY = world.y - dragSelectionRef.current.startWorld.y;
        const constrained = constrainDragDelta(rawDeltaX, rawDeltaY, event.shiftKey);
        const deltaX = clamp(
          constrained.deltaX,
          -dragSelectionRef.current.bounds.minX,
          FLOOR_PLAN_WORLD_WIDTH - dragSelectionRef.current.bounds.maxX,
        );
        const deltaY = clamp(
          constrained.deltaY,
          -dragSelectionRef.current.bounds.minY,
          FLOOR_PLAN_WORLD_HEIGHT - dragSelectionRef.current.bounds.maxY,
        );

        dragSelectionRef.current.moved = true;
        mutatePlan((draft) => {
          draft.walls.forEach((wall) => {
            const origin = dragSelectionRef.current?.wallOrigins[wall.id];
            if (!origin) {
              return;
            }
            wall.x1 = origin.x1 + deltaX;
            wall.y1 = origin.y1 + deltaY;
            wall.x2 = origin.x2 + deltaX;
            wall.y2 = origin.y2 + deltaY;
          });
          draft.cameras.forEach((camera) => {
            const origin = dragSelectionRef.current?.cameraOrigins[camera.id];
            if (!origin) {
              return;
            }
            camera.x = origin.x + deltaX;
            camera.y = origin.y + deltaY;
          });
        }, false);
        return;
      }

      if (dragWallHandleRef.current) {
        let world = clampPointToWorld(
          snapPoint(
            clientToWorld(event.clientX, event.clientY, container, planRef.current.view),
          ),
        );
        if (event.shiftKey && dragWallHandleRef.current) {
          world = snapWallEnd(dragWallHandleRef.current.anchor, world);
        }
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
            groupId: null,
          };
          mutatePlan((draft) => {
            draft.walls.push(wall);
          });
          setSelection(createSelection([wall.id], []));
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
            setSelection(createSelection(walls.map((wall) => wall.id), []));
          }
        }
      }

      if (marqueeRef.current) {
        const { start, current, additive } = marqueeRef.current;
        marqueeRef.current = null;
        setMarqueeRect(null);
        const nextSelection = selectionFromRect(planRef.current, start, current);
        setSelection((previous) => (additive ? mergeSelections(previous, nextSelection) : nextSelection));
      }

      if (dragSelectionRef.current) {
        const moved = dragSelectionRef.current.moved;
        dragSelectionRef.current = null;
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
  }, [mutatePlan, pushHistory, replacePlan, roomPreview, wallPreview]);

  const beginPan = useCallback((clientX: number, clientY: number) => {
    panRef.current = {
      startX: clientX,
      startY: clientY,
      originX: planRef.current.view.x,
      originY: planRef.current.view.y,
    };
  }, []);

  const buildDragSelectionSnapshot = useCallback(
    (nextSelection: PlannerSelection, startWorld: PlannerPoint) => {
      if (!nextSelection) {
        return null;
      }

      const selectedWalls = planRef.current.walls.filter((wall) =>
        nextSelection.wallIds.includes(wall.id),
      );
      const selectedCameras = planRef.current.cameras.filter((camera) =>
        nextSelection.cameraIds.includes(camera.id),
      );

      const xValues = [
        ...selectedWalls.flatMap((wall) => [wall.x1, wall.x2]),
        ...selectedCameras.map((camera) => camera.x),
      ];
      const yValues = [
        ...selectedWalls.flatMap((wall) => [wall.y1, wall.y2]),
        ...selectedCameras.map((camera) => camera.y),
      ];

      return {
        wallIds: nextSelection.wallIds,
        cameraIds: nextSelection.cameraIds,
        startWorld,
        moved: false,
        bounds: {
          minX: xValues.length > 0 ? Math.min(...xValues) : 0,
          maxX: xValues.length > 0 ? Math.max(...xValues) : 0,
          minY: yValues.length > 0 ? Math.min(...yValues) : 0,
          maxY: yValues.length > 0 ? Math.max(...yValues) : 0,
        },
        wallOrigins: Object.fromEntries(selectedWalls.map((wall) => [wall.id, { ...wall }])),
        cameraOrigins: Object.fromEntries(
          selectedCameras.map((camera) => [camera.id, { x: camera.x, y: camera.y }]),
        ),
      };
    },
    [],
  );

  const nudgeSelection = useCallback(
    (rawDeltaX: number, rawDeltaY: number) => {
      const currentSelection = selectionRef.current;
      if (!currentSelection) {
        return;
      }

      const snapshot = buildDragSelectionSnapshot(currentSelection, { x: 0, y: 0 });
      if (!snapshot) {
        return;
      }

      const deltaX = clamp(
        rawDeltaX,
        -snapshot.bounds.minX,
        FLOOR_PLAN_WORLD_WIDTH - snapshot.bounds.maxX,
      );
      const deltaY = clamp(
        rawDeltaY,
        -snapshot.bounds.minY,
        FLOOR_PLAN_WORLD_HEIGHT - snapshot.bounds.maxY,
      );

      if (deltaX === 0 && deltaY === 0) {
        return;
      }

      mutatePlan((draft) => {
        draft.walls.forEach((wall) => {
          const origin = snapshot.wallOrigins[wall.id];
          if (!origin) {
            return;
          }
          wall.x1 = origin.x1 + deltaX;
          wall.y1 = origin.y1 + deltaY;
          wall.x2 = origin.x2 + deltaX;
          wall.y2 = origin.y2 + deltaY;
        });
        draft.cameras.forEach((camera) => {
          const origin = snapshot.cameraOrigins[camera.id];
          if (!origin) {
            return;
          }
          camera.x = origin.x + deltaX;
          camera.y = origin.y + deltaY;
        });
      });
    },
    [buildDragSelectionSnapshot, mutatePlan],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        Boolean(target?.isContentEditable);
      if (isTypingTarget) {
        return;
      }

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

      if (isMeta && event.key.toLowerCase() === "g" && event.shiftKey) {
        event.preventDefault();
        ungroupSelection();
        return;
      }

      if (isMeta && event.key.toLowerCase() === "g") {
        event.preventDefault();
        groupSelection();
        return;
      }

      if (isMeta && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelection(
          createSelection(
            planRef.current.walls.map((wall) => wall.id),
            planRef.current.cameras.map((camera) => camera.id),
          ),
        );
        return;
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        const step = event.shiftKey ? FLOOR_PLAN_GRID_SIZE * 2 : FLOOR_PLAN_GRID_SIZE;
        const deltas = {
          ArrowUp: { x: 0, y: -step },
          ArrowDown: { x: 0, y: step },
          ArrowLeft: { x: -step, y: 0 },
          ArrowRight: { x: step, y: 0 },
        } as const;
        const next = deltas[event.key as keyof typeof deltas];
        if (next) {
          event.preventDefault();
          nudgeSelection(next.x, next.y);
          return;
        }
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelection();
        return;
      }

      if (event.key === "Escape") {
        wallDrawRef.current = null;
        roomDrawRef.current = null;
        marqueeRef.current = null;
        dragSelectionRef.current = null;
        dragWallHandleRef.current = null;
        setWallPreview(null);
        setRoomPreview(null);
        setMarqueeRect(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelection, groupSelection, nudgeSelection, redo, undo, ungroupSelection]);

  const resolvePointerWorld = useCallback((event: MouseEvent) => {
    const container = containerRef.current;
    if (!container) {
      return null;
    }
    return clampPointToWorld(
      snapPoint(clientToWorld(event.clientX, event.clientY, container, planRef.current.view)),
    );
  }, []);

  const handleStageMouseDown = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      if (event.evt.button === 1 || (tool === "pan" && event.evt.button === 0)) {
        event.evt.preventDefault();
        beginPan(event.evt.clientX, event.evt.clientY);
        return;
      }

      if (event.evt.button !== 0) {
        return;
      }

      const worldPoint = resolvePointerWorld(event.evt);
      if (!worldPoint) {
        return;
      }

      if (tool === "camera") {
        const camera = createCameraMarker(worldPoint);
        mutatePlan((draft) => {
          draft.cameras.push(camera);
        });
        setSelection(createSelection([], [camera.id]));
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

      if (tool === "select") {
        const additive = event.evt.ctrlKey || event.evt.metaKey;
        marqueeRef.current = {
          start: worldPoint,
          current: worldPoint,
          additive,
        };
        setMarqueeRect(normalizeRect(worldPoint, worldPoint));
        if (!additive) {
          setSelection(null);
        }
        return;
      }

      if (!(event.evt.ctrlKey || event.evt.metaKey)) {
        setSelection(null);
      }
    },
    [beginPan, mutatePlan, resolvePointerWorld, tool],
  );

  const handleCameraMouseDown = useCallback(
    (cameraId: string, event: KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      if (event.evt.button === 1) {
        event.evt.preventDefault();
        beginPan(event.evt.clientX, event.evt.clientY);
        return;
      }

      if (event.evt.button !== 0) {
        return;
      }

      if (event.evt.ctrlKey || event.evt.metaKey) {
        setSelection((current) => toggleEntitySelection(current, "camera", cameraId));
        return;
      }

      const nextSelection = isEntitySelected(selectionRef.current, "camera", cameraId)
        ? selectionRef.current
        : selectEntity(planRef.current, "camera", cameraId);
      setSelection(nextSelection);

      if (tool !== "select") {
        return;
      }

      const startWorld = resolvePointerWorld(event.evt);
      if (!startWorld) {
        return;
      }
      dragSelectionRef.current = buildDragSelectionSnapshot(nextSelection, startWorld);
    },
    [beginPan, buildDragSelectionSnapshot, resolvePointerWorld, tool],
  );

  const handleWallMouseDown = useCallback(
    (wall: FloorWall, event: KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      if (event.evt.button === 1) {
        event.evt.preventDefault();
        beginPan(event.evt.clientX, event.evt.clientY);
        return;
      }

      if (event.evt.button !== 0) {
        return;
      }

      if (event.evt.ctrlKey || event.evt.metaKey) {
        setSelection((current) => toggleEntitySelection(current, "wall", wall.id));
        return;
      }

      const nextSelection = isEntitySelected(selectionRef.current, "wall", wall.id)
        ? selectionRef.current
        : selectEntity(planRef.current, "wall", wall.id);
      setSelection(nextSelection);

      if (tool !== "select") {
        return;
      }

      const startWorld = resolvePointerWorld(event.evt);
      if (!startWorld) {
        return;
      }
      dragSelectionRef.current = buildDragSelectionSnapshot(nextSelection, startWorld);
    },
    [beginPan, buildDragSelectionSnapshot, resolvePointerWorld, tool],
  );

  const handleWallHandleMouseDown = useCallback(
    (wallId: string, endpoint: "start" | "end", event: KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      if (event.evt.button !== 0) {
        return;
      }
      setSelection(createSelection([wallId], []));
      const wall = planRef.current.walls.find((item) => item.id === wallId);
      if (!wall) {
        return;
      }
      dragWallHandleRef.current = {
        wallId,
        endpoint,
        moved: false,
        anchor:
          endpoint === "start"
            ? { x: wall.x2, y: wall.y2 }
            : { x: wall.x1, y: wall.y1 },
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
        <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white/95 p-2 shadow-sm backdrop-blur">
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
          <CompactActionButton disabled={!canGroup} onClick={groupSelection}>
            {t("group_selection")}
          </CompactActionButton>
          <CompactActionButton disabled={!canUngroup} onClick={ungroupSelection}>
            {t("ungroup_selection")}
          </CompactActionButton>
          <div className="mx-1 h-6 w-px bg-gray-200" />
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
              dragSelectionRef.current = null;
              dragWallHandleRef.current = null;
              replacePlan(next, false);
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <div className="absolute bottom-4 left-4 z-20 max-w-3xl rounded-xl border border-gray-200 bg-white/95 px-4 py-2 text-xs text-gray-600 shadow-sm backdrop-blur">
          {toolHint(tool, t)} · {t("middle_pan_hint")} · {t("multi_select_hint")} · {t("box_select_hint")} · {t("shift_drag_hint")} · {t("select_all_hint")} · {t("preset_hint")}
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

                {marqueeRect ? (
                  <Rect
                    x={marqueeRect.x}
                    y={marqueeRect.y}
                    width={marqueeRect.width}
                    height={marqueeRect.height}
                    fill="#2563eb22"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dash={[12, 8]}
                    listening={false}
                  />
                ) : null}

                {plan.walls.map((wall) => {
                  const isSelected = isEntitySelected(selection, "wall", wall.id);
                  return (
                    <Group key={wall.id}>
                      <Line
                        points={[wall.x1, wall.y1, wall.x2, wall.y2]}
                        stroke={isSelected ? "#2563eb" : wall.groupId ? "#1f2937" : "#111827"}
                        strokeWidth={isSelected ? 12 : 10}
                        hitStrokeWidth={26}
                        lineCap="round"
                        onMouseDown={(event) => handleWallMouseDown(wall, event)}
                      />

                      {isSelected && selectedWallCount === 1 && selectedCameraCount === 0 ? (
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
                  const isSelected = isEntitySelected(selection, "camera", camera.id);
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
                        stroke={isSelected ? "#111827" : "#ffffff"}
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

        {isBatchSelection ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <div className="mb-1 font-medium text-gray-900">{t("batch_selected")}</div>
            <div className="mb-2 text-xs text-gray-500">
              {t("batch_selected_summary", {
                walls: selectedWallCount,
                cameras: selectedCameraCount,
              })}
            </div>
            <div className="mb-3 text-xs leading-5 text-gray-500">
              {selectedGroupIds.length > 0 ? t("grouped_selection_hint") : t("multi_select_hint")}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={!canGroup}
                onClick={groupSelection}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${
                  canGroup
                    ? "bg-gray-900 text-white hover:bg-gray-800"
                    : "cursor-not-allowed bg-gray-200 text-gray-400"
                }`}
              >
                {t("group_selection")}
              </button>
              <button
                type="button"
                disabled={!canUngroup}
                onClick={ungroupSelection}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${
                  canUngroup
                    ? "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                    : "cursor-not-allowed bg-gray-200 text-gray-400"
                }`}
              >
                {t("ungroup_selection")}
              </button>
              <button
                type="button"
                onClick={deleteSelection}
                className="rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-600"
              >
                {t("delete_selected")}
              </button>
            </div>
          </div>
        ) : selectedCamera ? (
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
            <div className="mt-2 text-[11px] text-gray-500">
              {selectedCamera.groupId ? t("grouped_item_hint") : t("single_item_hint")}
            </div>
          </div>
        ) : selectedWall ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <div className="mb-1 font-medium text-gray-900">{t("wall_selected")}</div>
            <div className="mb-2 text-xs text-gray-500">#{selectedWall.id}</div>
            <div className="mb-3 text-xs leading-5 text-gray-500">{t("wall_edit_tip")}</div>
            <div className="mb-3 text-[11px] leading-5 text-gray-500">
              {selectedWall.groupId ? t("grouped_item_hint") : t("single_item_hint")}
            </div>
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
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("selection_empty_description_v3")} />
          </div>
        )}
      </aside>
    </div>
  );
}
