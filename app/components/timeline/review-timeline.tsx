import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import type { TimeRange } from "~/service/api/recording/state";
import type { Event } from "~/service/api/event/state";
import { cn } from "~/lib/utils";

interface ReviewTimelineProps {
  /** 录像时间段列表 */
  timeRanges: TimeRange[];
  /** 事件列表 */
  events: Event[];
  /** 当前播放时间（毫秒时间戳） */
  currentTime: number;
  /** 时间范围开始（毫秒时间戳） */
  startTime: number;
  /** 时间范围结束（毫秒时间戳） */
  endTime: number;
  /** 时间变化回调 */
  onTimeChange: (time: number) => void;
  /** 是否加载中 */
  isLoading?: boolean;
}

/**
 * Frigate 风格的垂直时间轴组件
 * 整个右侧区域，从上到下表示从最新到最旧的时间
 * 蓝色区域表示有录像，橙色波形表示有活动/事件
 */
export function ReviewTimeline({
  timeRanges,
  events,
  currentTime,
  startTime,
  endTime,
  onTimeChange,
  isLoading = false,
}: ReviewTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const totalDuration = endTime - startTime;

  // 生成时间刻度（每小时一个大刻度，每15分钟一个小刻度）
  const timeMarkers = useMemo(() => {
    const markers: { time: number; label: string; isHour: boolean }[] = [];
    // 从结束时间向开始时间生成
    const hourMs = 60 * 60 * 1000;
    const quarterMs = 15 * 60 * 1000;

    // 找到第一个整点
    const firstHour = new Date(endTime);
    firstHour.setMinutes(0, 0, 0);
    let currentMarker = firstHour.getTime();

    while (currentMarker >= startTime) {
      const date = new Date(currentMarker);
      const isHour = date.getMinutes() === 0;
      if (isHour) {
        markers.push({
          time: currentMarker,
          label: formatTimeLabel(date),
          isHour: true,
        });
      }
      currentMarker -= quarterMs;
    }

    return markers;
  }, [startTime, endTime]);

  // 计算时间对应的位置百分比（从顶部开始，顶部是最新时间）
  const getPositionPercent = useCallback(
    (time: number) => {
      return ((endTime - time) / totalDuration) * 100;
    },
    [endTime, totalDuration],
  );

  // 计算位置对应的时间
  const getTimeFromPosition = useCallback(
    (y: number, containerHeight: number) => {
      const percent = y / containerHeight;
      return endTime - percent * totalDuration;
    },
    [endTime, totalDuration],
  );

  // 处理指针事件
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!containerRef.current) return;
      setIsDragging(true);
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const time = getTimeFromPosition(y, rect.height);
      onTimeChange(Math.max(startTime, Math.min(endTime, time)));
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [getTimeFromPosition, onTimeChange, startTime, endTime],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const time = getTimeFromPosition(y, rect.height);
      onTimeChange(Math.max(startTime, Math.min(endTime, time)));
    },
    [isDragging, getTimeFromPosition, onTimeChange, startTime, endTime],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 计算事件密度（用于绘制波形）
  const eventDensity = useMemo(() => {
    const bucketCount = 100;
    const bucketDuration = totalDuration / bucketCount;
    const density: number[] = new Array(bucketCount).fill(0);

    for (const event of events) {
      const bucketIndex = Math.floor(
        (endTime - event.started_at) / bucketDuration,
      );
      if (bucketIndex >= 0 && bucketIndex < bucketCount) {
        density[bucketIndex]++;
      }
    }

    // 归一化
    const maxDensity = Math.max(...density, 1);
    return density.map((d) => d / maxDensity);
  }, [events, endTime, totalDuration]);

  // 当前时间指示器位置
  const currentTimePercent = getPositionPercent(currentTime);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 当前时间显示 */}
      <div className="h-10 flex items-center justify-center border-b border-gray-700">
        <span className="text-xs font-mono text-red-400">
          {formatTimeDisplay(new Date(currentTime))}
        </span>
      </div>

      {/* 时间轴主体 */}
      <div
        ref={containerRef}
        className="flex-1 relative cursor-pointer select-none overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* 背景 */}
        <div className="absolute inset-0 bg-gray-900" />

        {/* 录像时段（蓝色背景） */}
        {timeRanges.map((range, index) => {
          const topPercent = getPositionPercent(range.end_ms);
          const bottomPercent = getPositionPercent(range.start_ms);
          const heightPercent = bottomPercent - topPercent;
          return (
            <div
              key={`range-${index}`}
              className="absolute left-8 right-0 bg-blue-500/30"
              style={{
                top: `${topPercent}%`,
                height: `${heightPercent}%`,
              }}
            />
          );
        })}

        {/* 事件密度波形（橙色） */}
        <div className="absolute left-8 right-0 top-0 bottom-0 flex flex-col">
          {eventDensity.map((density, index) => (
            <div
              key={`density-${index}`}
              className="flex-1 flex items-center justify-end"
            >
              {density > 0 && (
                <div
                  className="h-full bg-orange-400"
                  style={{
                    width: `${Math.max(density * 100, 10)}%`,
                    opacity: 0.3 + density * 0.7,
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* 时间刻度 */}
        {timeMarkers.map((marker) => {
          const topPercent = getPositionPercent(marker.time);
          if (topPercent < 0 || topPercent > 100) return null;
          return (
            <div
              key={marker.time}
              className="absolute left-0 right-0 flex items-center pointer-events-none"
              style={{ top: `${topPercent}%` }}
            >
              <div className="w-8 flex items-center justify-end pr-1">
                <span className="text-[10px] text-gray-400">
                  {marker.label}
                </span>
              </div>
              <div className="flex-1 h-px bg-gray-600" />
            </div>
          );
        })}

        {/* 当前时间指示器（红色横线 + 左侧三角形） */}
        <div
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{ top: `${currentTimePercent}%` }}
        >
          <div className="relative flex items-center -translate-y-1/2">
            {/* 红色横线 */}
            <div className="absolute left-0 right-0 h-0.5 bg-red-500" />
            {/* 左侧三角形手柄 */}
            <div
              className="absolute left-0 w-0 h-0"
              style={{
                borderTop: "6px solid transparent",
                borderBottom: "6px solid transparent",
                borderLeft: "8px solid #ef4444",
              }}
            />
            {/* 右侧小圆点 */}
            <div className="absolute right-0 w-2 h-2 bg-red-500 rounded-full -translate-x-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

// 格式化时间标签（如 "12 PM"）
function formatTimeLabel(date: Date): string {
  const hours = date.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12} ${ampm}`;
}

// 格式化时间显示（如 "12:42:39 PM"）
function formatTimeDisplay(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export default ReviewTimeline;
