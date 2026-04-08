import { useTranslation } from "react-i18next";
import type { CameraMarker, FloorWall, PlannerView } from "~/pages/desktop/floor_plan.types";
import { FLOOR_PLAN_WORLD_HEIGHT, FLOOR_PLAN_WORLD_WIDTH } from "~/pages/desktop/floor_plan.storage";

const MAP_W = 168;
const MAP_H = 105;

type FloorPlanMinimapProps = {
  walls: FloorWall[];
  cameras: CameraMarker[];
  view: PlannerView;
  viewportWidth: number;
  viewportHeight: number;
  onCenterWorld: (worldX: number, worldY: number) => void;
};

/**
 * 为什么小地图用 SVG + viewBox：
 * 墙线在世界坐标是任意斜线，用百分比 div 旋转容易算错；SVG 线段与圆点与 Konva 世界系一一对应，点击再反算世界坐标即可平移主视口。
 */
export function FloorPlanMinimap({
  walls,
  cameras,
  view,
  viewportWidth,
  viewportHeight,
  onCenterWorld,
}: FloorPlanMinimapProps) {
  const { t } = useTranslation("desktop");

  const worldW = FLOOR_PLAN_WORLD_WIDTH;
  const worldH = FLOOR_PLAN_WORLD_HEIGHT;

  const vpLeft = (-view.x) / view.scale;
  const vpTop = (-view.y) / view.scale;
  const vpW = viewportWidth / view.scale;
  const vpH = viewportHeight / view.scale;

  const handleSvgClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width;
    const ny = (event.clientY - rect.top) / rect.height;
    onCenterWorld(nx * worldW, ny * worldH);
  };

  return (
    <div
      className="pointer-events-auto absolute bottom-24 left-4 z-30 flex flex-col gap-1 rounded-lg border border-gray-200 bg-white/95 p-1.5 shadow-md backdrop-blur"
      title={t("minimap_hint")}
    >
      <div className="text-[10px] font-medium text-gray-500">{t("minimap_title")}</div>
      <svg
        role="img"
        aria-label={t("minimap_title")}
        width={MAP_W}
        height={MAP_H}
        viewBox={`0 0 ${worldW} ${worldH}`}
        className="cursor-crosshair rounded border border-gray-200 bg-slate-50"
        preserveAspectRatio="none"
        onClick={handleSvgClick}
      >
        {walls.map((wall) => (
          <line
            key={wall.id}
            x1={wall.x1}
            y1={wall.y1}
            x2={wall.x2}
            y2={wall.y2}
            stroke="#94a3b8"
            strokeWidth={worldW / 200}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {cameras.map((camera) => (
          <circle
            key={camera.id}
            cx={camera.x}
            cy={camera.y}
            r={worldW / 160}
            fill="#3b82f6"
            stroke="#fff"
            strokeWidth={worldW / 400}
          />
        ))}
        <rect
          x={Math.max(0, vpLeft)}
          y={Math.max(0, vpTop)}
          width={Math.min(worldW, vpW)}
          height={Math.min(worldH, vpH)}
          fill="rgba(59,130,246,0.12)"
          stroke="#2563eb"
          strokeWidth={worldW / 200}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      </svg>
    </div>
  );
}
