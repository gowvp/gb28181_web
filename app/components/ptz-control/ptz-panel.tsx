import { useState, useCallback, memo } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Slider } from "~/components/ui/slider";
import { Badge } from "~/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { PTZControl, type PTZDirection } from "~/service/api/channel/channel";
import { toast } from "sonner";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Minus,
  Plus,
  RotateCcw,
  Crosshair,
} from "lucide-react";

interface PTZPanelProps {
  channelId: string;
  deviceType?: string; // "GB28181" | "ONVIF" | "RTMP" | "RTSP"
  /** 云台类型 (0=无云台/未知, >0=有云台) - 来自后端通道 ptztype 字段 */
  ptztype?: number;
}

// 测试模式：不判断是否支持 PTZ，始终显示控制面板
const TEST_MODE = true;

// 独立的PTZ按钮组件，避免不必要的重渲染
interface PTZButtonProps {
  direction: PTZDirection;
  activeDirection: PTZDirection | null;
  isPending: boolean;
  onStartMove: (
    direction: PTZDirection,
    e?: React.MouseEvent | React.TouchEvent,
  ) => void;
  onStopMove: (e?: React.MouseEvent | React.TouchEvent) => void;
  icon: React.ReactNode;
  className?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
}

const ptzButtonPropsAreEqual = (
  prevProps: PTZButtonProps,
  nextProps: PTZButtonProps,
) => {
  return (
    prevProps.direction === nextProps.direction &&
    prevProps.activeDirection === nextProps.activeDirection &&
    prevProps.isPending === nextProps.isPending &&
    prevProps.icon === nextProps.icon &&
    prevProps.className === nextProps.className &&
    prevProps.variant === nextProps.variant &&
    prevProps.onStartMove === nextProps.onStartMove &&
    prevProps.onStopMove === nextProps.onStopMove
  );
};

const PTZButton = memo(
  ({
    direction,
    activeDirection,
    isPending,
    onStartMove,
    onStopMove,
    icon,
    className = "",
    variant,
  }: PTZButtonProps) => {
    const isActive = activeDirection === direction;
    const buttonVariant = variant || (isActive ? "default" : "outline");

    return (
      <Button
        size="icon"
        variant={buttonVariant}
        className={`h-12 w-12 ${className}`}
        onMouseDown={(e) => onStartMove(direction, e)}
        onMouseUp={(e) => onStopMove(e)}
        onMouseLeave={(e) => onStopMove(e)}
        disabled={isPending}
      >
        {icon}
      </Button>
    );
  },
  ptzButtonPropsAreEqual,
);

PTZButton.displayName = "PTZButton";

// 对角线方向按钮组件
interface DiagonalPTZButtonProps {
  direction: PTZDirection;
  activeDirection: PTZDirection | null;
  isPending: boolean;
  onStartMove: (
    direction: PTZDirection,
    e?: React.MouseEvent | React.TouchEvent,
  ) => void;
  onStopMove: (e?: React.MouseEvent | React.TouchEvent) => void;
  label: string;
}

// 自定义比较函数
const diagonalPTZButtonPropsAreEqual = (
  prevProps: DiagonalPTZButtonProps,
  nextProps: DiagonalPTZButtonProps,
) => {
  return (
    prevProps.direction === nextProps.direction &&
    prevProps.activeDirection === nextProps.activeDirection &&
    prevProps.isPending === nextProps.isPending &&
    prevProps.label === nextProps.label &&
    prevProps.onStartMove === nextProps.onStartMove &&
    prevProps.onStopMove === nextProps.onStopMove
  );
};

const DiagonalPTZButton = memo(
  ({
    direction,
    activeDirection,
    isPending,
    onStartMove,
    onStopMove,
    label,
  }: DiagonalPTZButtonProps) => {
    const isActive = activeDirection === direction;

    return (
      <Button
        size="sm"
        variant={isActive ? "default" : "outline"}
        className="h-8 text-xs"
        onMouseDown={(e) => onStartMove(direction, e)}
        onMouseUp={(e) => onStopMove(e)}
        onMouseLeave={(e) => onStopMove(e)}
        disabled={isPending}
      >
        {label}
      </Button>
    );
  },
  diagonalPTZButtonPropsAreEqual,
);

DiagonalPTZButton.displayName = "DiagonalPTZButton";

// 变焦按钮组件
interface ZoomButtonProps {
  direction: "zoomin" | "zoomout";
  activeDirection: PTZDirection | null;
  isPending: boolean;
  onZoom: (
    direction: "zoomin" | "zoomout",
    e?: React.MouseEvent | React.TouchEvent,
  ) => void;
  onStopMove: (e?: React.MouseEvent | React.TouchEvent) => void;
  icon: React.ReactNode;
  label: string;
}

// 自定义比较函数
const zoomButtonPropsAreEqual = (
  prevProps: ZoomButtonProps,
  nextProps: ZoomButtonProps,
) => {
  return (
    prevProps.direction === nextProps.direction &&
    prevProps.activeDirection === nextProps.activeDirection &&
    prevProps.isPending === nextProps.isPending &&
    prevProps.icon === nextProps.icon &&
    prevProps.label === nextProps.label &&
    prevProps.onZoom === nextProps.onZoom &&
    prevProps.onStopMove === nextProps.onStopMove
  );
};

const ZoomButton = memo(
  ({
    direction,
    activeDirection,
    isPending,
    onZoom,
    onStopMove,
    icon,
    label,
  }: ZoomButtonProps) => {
    const isActive = activeDirection === direction;

    return (
      <Button
        variant={isActive ? "default" : "outline"}
        size="sm"
        className="gap-2"
        onMouseDown={(e) => onZoom(direction, e)}
        onMouseUp={(e) => onStopMove(e)}
        onMouseLeave={(e) => onStopMove(e)}
        disabled={isPending}
      >
        {icon}
        <span className="text-xs">{label}</span>
      </Button>
    );
  },
  zoomButtonPropsAreEqual,
);

ZoomButton.displayName = "ZoomButton";

export function PTZPanel({ channelId, deviceType, ptztype }: PTZPanelProps) {
  const [speed, setSpeed] = useState(0.5);
  const [activeDirection, setActiveDirection] = useState<PTZDirection | null>(
    null,
  );
  // 为每个方向维护独立的 pending 状态
  const [pendingDirections, setPendingDirections] = useState<Set<PTZDirection>>(
    new Set(),
  );

  // 调试日志
  console.log("[PTZPanel] Props:", {
    channelId,
    deviceType,
    ptztype,
    TEST_MODE,
  });

  // PTZ 控制 mutation
  const ptzMutation = useMutation({
    mutationFn: (data: Parameters<typeof PTZControl>[1]) =>
      PTZControl(channelId, data),
    onSuccess: () => {
      // 成功时不显示提示,避免频繁提示
    },
    onError: (error: any) => {
      console.error("PTZ 控制失败:", error);
      toast.error(error?.message || "云台控制失败");
    },
  });

  // 开始连续移动 - 使用稳定的函数引用
  const handleStartMove = useCallback(
    (direction: PTZDirection, e?: React.MouseEvent | React.TouchEvent) => {
      // 阻止事件冒泡和默认行为
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // 检查该方向是否已经在 pending 状态
      setPendingDirections((prev) => {
        if (prev.has(direction)) return prev;
        const newSet = new Set(prev);
        newSet.add(direction);
        return newSet;
      });

      setActiveDirection(direction);
      ptzMutation.mutate({
        action: "continuous",
        direction,
        speed,
      });
    },
    [speed],
  );

  // 停止移动 - 使用稳定的函数引用
  const handleStopMove = useCallback(
    (e?: React.MouseEvent | React.TouchEvent) => {
      // 阻止事件冒泡和默认行为
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // 清除所有 pending 状态
      setPendingDirections(new Set());

      // 检查是否有活动方向
      setActiveDirection((prev) => {
        if (prev) {
          ptzMutation.mutate({
            action: "stop",
          });
        }
        return null;
      });
    },
    [],
  );

  // 变焦控制
  const handleZoom = useCallback(
    (
      direction: "zoomin" | "zoomout",
      e?: React.MouseEvent | React.TouchEvent,
    ) => {
      handleStartMove(direction, e);
    },
    [handleStartMove],
  );

  // 检查是否支持 PTZ
  // 测试模式：只检查协议类型，不检查 ptztype
  const isSupportedProtocol =
    deviceType === "GB28181" || deviceType === "ONVIF";
  const supportsPTZ = TEST_MODE
    ? isSupportedProtocol
    : isSupportedProtocol && (ptztype ?? 0) > 0;

  // if (!supportsPTZ) {
  //   return (
  //     <Card className="border-dashed">
  //       <CardContent className="pt-6">
  //         <div className="text-center text-muted-foreground">
  //           <Crosshair className="w-12 h-12 mx-auto mb-2 opacity-30" />
  //           <p className="text-sm">该通道类型不支持云台控制</p>
  //           <p className="text-xs mt-1">仅 GB28181 和 ONVIF 设备支持</p>
  //         </div>
  //       </CardContent>
  //     </Card>
  //   );
  // }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>云台控制</span>
          <Badge variant="outline" className="text-xs">
            {deviceType}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 方向控制 */}
        <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
          {/* 第一行: 上 */}
          <div />
          <PTZButton
            direction="up"
            activeDirection={activeDirection}
            isPending={pendingDirections.has("up")}
            onStartMove={handleStartMove}
            onStopMove={handleStopMove}
            icon={<ArrowUp className="h-5 w-5" />}
          />
          <div />

          {/* 第二行: 左 停止 右 */}
          <PTZButton
            direction="left"
            activeDirection={activeDirection}
            isPending={pendingDirections.has("left")}
            onStartMove={handleStartMove}
            onStopMove={handleStopMove}
            icon={<ArrowLeft className="h-5 w-5" />}
          />
          <Button
            size="icon"
            variant="destructive"
            className="h-12 w-12"
            onClick={(e) => handleStopMove(e)}
            // disabled={pendingDirections.size > 0}
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
          <PTZButton
            direction="right"
            activeDirection={activeDirection}
            isPending={pendingDirections.has("right")}
            onStartMove={handleStartMove}
            onStopMove={handleStopMove}
            icon={<ArrowRight className="h-5 w-5" />}
          />

          {/* 第三行: 下 */}
          <div />
          <PTZButton
            direction="down"
            activeDirection={activeDirection}
            isPending={pendingDirections.has("down")}
            onStartMove={handleStartMove}
            onStopMove={handleStopMove}
            icon={<ArrowDown className="h-5 w-5" />}
          />
          <div />
        </div>

        {/* 对角线方向 */}
        <div className="grid grid-cols-4 gap-2 max-w-[200px] mx-auto">
          <DiagonalPTZButton
            direction="upleft"
            activeDirection={activeDirection}
            isPending={pendingDirections.has("upleft")}
            onStartMove={handleStartMove}
            onStopMove={handleStopMove}
            label="↖"
          />
          <DiagonalPTZButton
            direction="upright"
            activeDirection={activeDirection}
            isPending={pendingDirections.has("upright")}
            onStartMove={handleStartMove}
            onStopMove={handleStopMove}
            label="↗"
          />
          <DiagonalPTZButton
            direction="downleft"
            activeDirection={activeDirection}
            isPending={pendingDirections.has("downleft")}
            onStartMove={handleStartMove}
            onStopMove={handleStopMove}
            label="↙"
          />
          <DiagonalPTZButton
            direction="downright"
            activeDirection={activeDirection}
            isPending={pendingDirections.has("downright")}
            onStartMove={handleStartMove}
            onStopMove={handleStopMove}
            label="↘"
          />
        </div>

        {/* 速度控制 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">速度</span>
            <span className="font-mono">{Math.round(speed * 100)}%</span>
          </div>
          <Slider
            value={[speed]}
            onValueChange={(value) => setSpeed(value[0])}
            min={0.1}
            max={1}
            step={0.1}
            disabled={pendingDirections.size > 0}
          />
        </div>

        {/* 变焦控制 */}
        <div className="grid grid-cols-2 gap-2">
          <ZoomButton
            direction="zoomin"
            activeDirection={activeDirection}
            isPending={pendingDirections.has("zoomin")}
            onZoom={handleZoom}
            onStopMove={handleStopMove}
            icon={<Plus className="h-4 w-4" />}
            label="放大"
          />
          <ZoomButton
            direction="zoomout"
            activeDirection={activeDirection}
            isPending={pendingDirections.has("zoomout")}
            onZoom={handleZoom}
            onStopMove={handleStopMove}
            icon={<Minus className="h-4 w-4" />}
            label="缩小"
          />
        </div>

        {/* 提示信息 */}
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>• 按住按钮移动,松开停止</p>
          <p>• GB28181 仅支持连续移动和停止</p>
        </div>
      </CardContent>
    </Card>
  );
}
