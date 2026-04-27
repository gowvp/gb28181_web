import { useMutation } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Minus,
  Plus,
  Square,
} from "lucide-react";
import { memo, useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Slider } from "~/components/ui/slider";
import { PTZControl, type PTZDirection } from "~/service/api/channel/channel";

interface PTZPanelProps {
  channelId: string;
  deviceType?: string;
  /** 云台类型 (0=无云台/未知, >0=有云台) - 来自后端通道 ptztype 字段 */
  ptztype?: number;
}

// 为什么: 开发/联调期 ptztype 尚未稳定返回, 允许面板始终显示, 生产期关闭即可。
const TEST_MODE = true;

type PtrEvt = React.MouseEvent | React.TouchEvent;

interface DirectionButtonProps {
  direction: PTZDirection;
  activeDirection: PTZDirection | null;
  onStart: (d: PTZDirection, e?: PtrEvt) => void;
  onStop: (e?: PtrEvt) => void;
  icon: React.ReactNode;
  ariaLabel: string;
}

// 为什么: 用 memo + 稳定回调引用避免速度滑块变动时全盘重渲染, 保障拖动手感。
const DirectionButton = memo(function DirectionButton({
  direction,
  activeDirection,
  onStart,
  onStop,
  icon,
  ariaLabel,
}: DirectionButtonProps) {
  const isActive = activeDirection === direction;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onMouseDown={(e) => onStart(direction, e)}
      onMouseUp={onStop}
      onMouseLeave={onStop}
      onTouchStart={(e) => onStart(direction, e)}
      onTouchEnd={onStop}
      className={`
        relative flex items-center justify-center
        h-11 w-11 sm:h-12 sm:w-12 rounded-xl select-none
        transition-all duration-150 active:scale-95
        border shadow-sm
        ${
          isActive
            ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30"
            : "bg-background text-foreground/80 border-border hover:bg-accent hover:text-foreground hover:-translate-y-[1px]"
        }
      `}
    >
      {icon}
    </button>
  );
});

interface ZoomButtonProps {
  direction: "zoomin" | "zoomout";
  activeDirection: PTZDirection | null;
  onStart: (d: PTZDirection, e?: PtrEvt) => void;
  onStop: (e?: PtrEvt) => void;
  icon: React.ReactNode;
}

const ZoomButton = memo(function ZoomButton({
  direction,
  activeDirection,
  onStart,
  onStop,
  icon,
}: ZoomButtonProps) {
  const isActive = activeDirection === direction;
  return (
    <button
      type="button"
      onMouseDown={(e) => onStart(direction, e)}
      onMouseUp={onStop}
      onMouseLeave={onStop}
      onTouchStart={(e) => onStart(direction, e)}
      onTouchEnd={onStop}
      className={`
        flex items-center justify-center
        h-9 rounded-lg border text-xs font-medium
        transition-all duration-150 active:scale-95 select-none
        ${
          isActive
            ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-background text-foreground/80 border-border hover:bg-accent"
        }
      `}
    >
      {icon}
    </button>
  );
});

export function PTZPanel({ channelId, deviceType, ptztype }: PTZPanelProps) {
  const [speed, setSpeed] = useState(0.5);
  const [activeDirection, setActiveDirection] = useState<PTZDirection | null>(
    null,
  );

  const ptzMutation = useMutation({
    mutationFn: (data: Parameters<typeof PTZControl>[1]) =>
      PTZControl(channelId, data),
    onError: (error: any) => {
      toast.error(error?.message || "云台控制失败");
    },
  });

  // 为什么: mousedown 立即发起 continuous, mouseup/leave/touchend 发 stop,
  // 同方向去重避免连发; speedRef 让回调引用保持稳定, 防止速度滑块变动时子组件重渲染。
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const handleStart = useCallback(
    (direction: PTZDirection, e?: PtrEvt) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      setActiveDirection((prev) => {
        if (prev === direction) return prev;
        ptzMutation.mutate({
          action: "continuous",
          direction,
          speed: speedRef.current,
        });
        return direction;
      });
    },
    [ptzMutation],
  );

  const handleStop = useCallback(
    (e?: PtrEvt) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      setActiveDirection((prev) => {
        if (prev) {
          ptzMutation.mutate({ action: "stop" });
        }
        return null;
      });
    },
    [ptzMutation],
  );

  const isSupportedProtocol =
    deviceType === "GB28181" || deviceType === "ONVIF";
  const supportsPTZ = TEST_MODE
    ? isSupportedProtocol
    : isSupportedProtocol && (ptztype ?? 0) > 0;

  if (!supportsPTZ) {
    return null;
  }

  const directionPad = (
    <div className="grid grid-cols-3 gap-1.5 w-fit mx-auto">
      <DirectionButton direction="upleft" activeDirection={activeDirection} onStart={handleStart} onStop={handleStop} icon={<ArrowUpLeft className="h-4 w-4" />} ariaLabel="左上" />
      <DirectionButton direction="up" activeDirection={activeDirection} onStart={handleStart} onStop={handleStop} icon={<ArrowUp className="h-4 w-4" />} ariaLabel="上" />
      <DirectionButton direction="upright" activeDirection={activeDirection} onStart={handleStart} onStop={handleStop} icon={<ArrowUpRight className="h-4 w-4" />} ariaLabel="右上" />
      <DirectionButton direction="left" activeDirection={activeDirection} onStart={handleStart} onStop={handleStop} icon={<ArrowLeft className="h-4 w-4" />} ariaLabel="左" />
      <button
        type="button"
        onClick={(e) => handleStop(e)}
        aria-label="停止"
        className="flex items-center justify-center h-11 w-11 sm:h-12 sm:w-12 rounded-xl select-none bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive hover:text-destructive-foreground transition-all duration-150 active:scale-95"
      >
        <Square className="h-3.5 w-3.5 fill-current" />
      </button>
      <DirectionButton direction="right" activeDirection={activeDirection} onStart={handleStart} onStop={handleStop} icon={<ArrowRight className="h-4 w-4" />} ariaLabel="右" />
      <DirectionButton direction="downleft" activeDirection={activeDirection} onStart={handleStart} onStop={handleStop} icon={<ArrowDownLeft className="h-4 w-4" />} ariaLabel="左下" />
      <DirectionButton direction="down" activeDirection={activeDirection} onStart={handleStart} onStop={handleStop} icon={<ArrowDown className="h-4 w-4" />} ariaLabel="下" />
      <DirectionButton direction="downright" activeDirection={activeDirection} onStart={handleStart} onStop={handleStop} icon={<ArrowDownRight className="h-4 w-4" />} ariaLabel="右下" />
    </div>
  );

  const controlPanel = (
    <div className="space-y-3 flex-1 min-w-0">
      {/* 速度控制 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">速度</span>
          <span className="font-mono tabular-nums text-foreground/80">
            {Math.round(speed * 100)}%
          </span>
        </div>
        <Slider
          value={[speed]}
          onValueChange={(v) => setSpeed(v[0])}
          min={0.1}
          max={1}
          step={0.1}
          disabled={activeDirection !== null}
          className="cursor-pointer"
        />
      </div>

      {/* 变焦控制 */}
      <div className="grid grid-cols-2 gap-1.5">
        <ZoomButton direction="zoomin" activeDirection={activeDirection} onStart={handleStart} onStop={handleStop} icon={<Plus className="h-4 w-4" />} />
        <ZoomButton direction="zoomout" activeDirection={activeDirection} onStart={handleStart} onStop={handleStop} icon={<Minus className="h-4 w-4" />} />
      </div>

      <div className="text-[10px] text-muted-foreground/70 text-center leading-relaxed">
        按住移动 · 松开停止
      </div>
    </div>
  );

  return (
    <Card className="border-primary/15 sm:border bg-gradient-to-b from-background to-muted/30 shadow-sm sm:shadow-sm border-0 sm:border-primary/15">
      <CardHeader className="pb-2 pt-2 sm:pt-3 px-1 sm:px-3">
        <CardTitle className="text-xs font-semibold flex items-center justify-between text-foreground/70">
          <span>云台控制</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-5 font-normal"
          >
            {deviceType || "PTZ"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-1 sm:px-3 pb-2 sm:pb-3">
        {/* 移动端左右布局，PC端上下布局 */}
        <div className="flex gap-3 sm:hidden mx-auto max-w-[350px]">
          <div className="shrink-0">{directionPad}</div>
          {controlPanel}
        </div>
        <div className="hidden sm:block space-y-3">
          {directionPad}
          {controlPanel}
        </div>
      </CardContent>
    </Card>
  );
}
