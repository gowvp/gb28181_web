export type PlannerTool = "select" | "wall" | "room" | "camera" | "pan";

export type FloorPlanTemplateId = "small_room" | "corridor" | "l_room";

export type PlannerPoint = {
  x: number;
  y: number;
};

export type PlannerView = {
  x: number;
  y: number;
  scale: number;
};

export type FloorWall = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  groupId?: string | null;
};

export type CameraMarker = {
  id: string;
  x: number;
  y: number;
  angle: number;
  fov: number;
  range: number;
  channelId: string | null;
  channelName: string | null;
  groupId?: string | null;
  deviceName?: string | null;
  latestEventAt?: number | null;
  latestEventImage?: string | null;
  latestEventLabel?: string | null;
  latestEventScore?: number | null;
};

export type FloorPlanState = {
  version: 3;
  walls: FloorWall[];
  cameras: CameraMarker[];
  view: PlannerView;
  updatedAt: number;
};

export type PlannerSelection = {
  wallIds: string[];
  cameraIds: string[];
} | null;

export type LatestCameraEvent = {
  channelId: string;
  startedAt: number;
  imageSrc: string;
  label: string;
  score: number;
};
