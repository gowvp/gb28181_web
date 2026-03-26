import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import type { PlaybackTimeRange } from "~/pages/recordings/time-mapping";

const MIN_WINDOW_MS = 60 * 1000;

export interface DayPlaybackTimelineProps {
  dayStartMs: number;
  dayEndMs: number;
  ranges: PlaybackTimeRange[];
  errorRanges?: PlaybackTimeRange[];
  currentTimeMs?: number | null;
  onSeek: (absoluteMs: number) => void;
  className?: string;
  compact?: boolean;
}

export default function DayPlaybackTimeline({
  dayStartMs,
  dayEndMs,
  ranges,
  errorRanges = [],
  currentTimeMs,
  onSeek,
  className,
  compact = false,
}: DayPlaybackTimelineProps) {
  const overviewRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverMs, setHoverMs] = useState<number | null>(null);
  const [viewStartMs, setViewStartMs] = useState(dayStartMs);
  const [viewEndMs, setViewEndMs] = useState(dayEndMs);

  const totalDurationMs = Math.max(dayEndMs - dayStartMs, 1);
  const viewDurationMs = Math.max(viewEndMs - viewStartMs, MIN_WINDOW_MS);

  useEffect(() => {
    setViewStartMs(dayStartMs);
    setViewEndMs(dayEndMs);
  }, [dayStartMs, dayEndMs]);

  const clampWindow = useCallback(
    (nextStart: number, nextDuration: number) => {
      const duration = Math.min(Math.max(nextDuration, MIN_WINDOW_MS), totalDurationMs);
      const maxStart = dayEndMs - duration;
      const start = Math.min(Math.max(nextStart, dayStartMs), maxStart);
      return {
        start,
        end: start + duration,
      };
    },
    [dayEndMs, dayStartMs, totalDurationMs],
  );

  const getAbsoluteMsFromClientX = useCallback(
    (clientX: number, element: HTMLDivElement | null, useFullDay = false) => {
      if (!element) return dayStartMs;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0) return dayStartMs;
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      if (useFullDay) {
        return dayStartMs + ratio * totalDurationMs;
      }
      return viewStartMs + ratio * viewDurationMs;
    },
    [dayStartMs, totalDurationMs, viewDurationMs, viewStartMs],
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const absoluteMs = getAbsoluteMsFromClientX(clientX, trackRef.current);
      onSeek(absoluteMs);
    },
    [getAbsoluteMsFromClientX, onSeek],
  );

  const handleOverviewClick = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const absoluteMs = getAbsoluteMsFromClientX(event.clientX, overviewRef.current, true);
      const centeredStart = absoluteMs - viewDurationMs / 2;
      const nextWindow = clampWindow(centeredStart, viewDurationMs);
      setViewStartMs(nextWindow.start);
      setViewEndMs(nextWindow.end);
      onSeek(absoluteMs);
    },
    [clampWindow, getAbsoluteMsFromClientX, onSeek, viewDurationMs],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      seekFromClientX(event.clientX);
    },
    [seekFromClientX],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const absoluteMs = getAbsoluteMsFromClientX(event.clientX, trackRef.current);
      setHoverMs(absoluteMs);
      if (isDragging) {
        onSeek(absoluteMs);
      }
    },
    [getAbsoluteMsFromClientX, isDragging, onSeek],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const element = trackRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const rect = element.getBoundingClientRect();
      const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;
      const cursorRatio = Math.min(Math.max(ratio, 0), 1);
      const anchorMs = viewStartMs + cursorRatio * viewDurationMs;

      if (event.shiftKey) {
        const delta = Math.sign(event.deltaY || event.deltaX || 0) * viewDurationMs * 0.15;
        const nextWindow = clampWindow(viewStartMs + delta, viewDurationMs);
        setViewStartMs(nextWindow.start);
        setViewEndMs(nextWindow.end);
        return;
      }

      const zoomFactor = event.deltaY > 0 ? 1.15 : 0.85;
      const nextDuration = viewDurationMs * zoomFactor;
      const nextStart = anchorMs - cursorRatio * nextDuration;
      const nextWindow = clampWindow(nextStart, nextDuration);
      setViewStartMs(nextWindow.start);
      setViewEndMs(nextWindow.end);
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", handleWheel);
    };
  }, [clampWindow, viewDurationMs, viewStartMs]);

  const ticks = useMemo(() => {
    const candidateSteps = [
      60 * 1000,
      5 * 60 * 1000,
      10 * 60 * 1000,
      15 * 60 * 1000,
      30 * 60 * 1000,
      60 * 60 * 1000,
      2 * 60 * 60 * 1000,
      3 * 60 * 60 * 1000,
      6 * 60 * 60 * 1000,
    ];
    const desiredTickCount = 8;
    const targetStep = viewDurationMs / desiredTickCount;
    const step = candidateSteps.find((item) => item >= targetStep) ?? candidateSteps[candidateSteps.length - 1];
    const first = Math.ceil(viewStartMs / step) * step;

    const result: number[] = [];
    for (let tick = first; tick <= viewEndMs; tick += step) {
      result.push(tick);
    }
    return result;
  }, [viewDurationMs, viewEndMs, viewStartMs]);

  const visibleRanges = useMemo(
    () => clipRangesToWindow(ranges, viewStartMs, viewEndMs),
    [ranges, viewEndMs, viewStartMs],
  );

  const visibleErrorRanges = useMemo(
    () => clipRangesToWindow(errorRanges, viewStartMs, viewEndMs),
    [errorRanges, viewEndMs, viewStartMs],
  );

  const currentRatio = currentTimeMs
    ? (currentTimeMs - viewStartMs) / viewDurationMs
    : null;
  const overviewCurrentRatio = currentTimeMs
    ? (currentTimeMs - dayStartMs) / totalDurationMs
    : null;
  const overviewWindowLeft = ((viewStartMs - dayStartMs) / totalDurationMs) * 100;
  const overviewWindowWidth = (viewDurationMs / totalDurationMs) * 100;

  return (
    <div className={cn(compact ? "space-y-3" : "space-y-4", className)}>
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
          <span>{compact ? "概览" : "全天概览"}</span>
          <span>{formatDateTime(viewStartMs)} - {formatDateTime(viewEndMs)}</span>
        </div>
        <div
          ref={overviewRef}
          className={cn("relative rounded-xl border border-gray-200 bg-gray-50 cursor-pointer overflow-hidden", compact ? "h-9" : "h-10")}
          onPointerDown={handleOverviewClick}
        >
          {ranges.map((range, index) => renderRangeBlock(range, index, dayStartMs, totalDurationMs, "overview-normal"))}
          {errorRanges.map((range, index) => renderRangeBlock(range, index, dayStartMs, totalDurationMs, "overview-error"))}
          <div
            className="absolute top-0 bottom-0 rounded-xl border-2 border-blue-500 bg-blue-100/35"
            style={{
              left: `${overviewWindowLeft}%`,
              width: `${Math.max(overviewWindowWidth, 2)}%`,
            }}
          />
          {overviewCurrentRatio !== null && overviewCurrentRatio >= 0 && overviewCurrentRatio <= 1 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500"
              style={{ left: `${overviewCurrentRatio * 100}%` }}
            />
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-gray-500 gap-3">
          <span>{compact ? "拖动定位" : "点击、拖动定位，滚轮缩放，Shift + 滚轮平移"}</span>
          <span>{hoverMs ? formatDateTime(hoverMs) : currentTimeMs ? formatDateTime(currentTimeMs) : "--:--:--"}</span>
        </div>
        <div
          ref={trackRef}
          className={cn("relative rounded-2xl border border-gray-200 bg-white cursor-pointer overflow-hidden touch-none select-none", compact ? "h-24" : "h-28")}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            handlePointerUp();
            setHoverMs(null);
          }}
          onDoubleClick={(event) => seekFromClientX(event.clientX)}
        >
          <div className={cn("absolute inset-x-0 bg-gray-50", compact ? "top-7 bottom-7" : "top-8 bottom-8")} />

          {ticks.map((tick) => {
            const left = ((tick - viewStartMs) / viewDurationMs) * 100;
            return (
              <div key={tick} className="absolute top-0 bottom-0" style={{ left: `${left}%` }}>
                <div className={cn("-translate-x-1/2 text-gray-500", compact ? "h-5 text-[10px]" : "h-6 text-[11px]")}>{formatAxisTime(tick, viewDurationMs)}</div>
                <div className="absolute top-6 bottom-0 border-l border-dashed border-gray-200" />
              </div>
            );
          })}

          {visibleRanges.map((range, index) => renderRangeBlock(range, index, viewStartMs, viewDurationMs, "detail-normal", compact))}
          {visibleErrorRanges.map((range, index) => renderRangeBlock(range, index, viewStartMs, viewDurationMs, "detail-error", compact))}

          {currentRatio !== null && currentRatio >= 0 && currentRatio <= 1 && (
            <div
              className="absolute top-0 bottom-0 z-20 w-0.5 bg-red-500"
              style={{ left: `${currentRatio * 100}%` }}
            >
              <div className={cn("absolute top-0 rounded-full border-2 border-white bg-red-500 shadow", compact ? "-left-1 h-2.5 w-2.5" : "-left-1.5 h-3 w-3")} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function clipRangesToWindow(ranges: PlaybackTimeRange[], viewStartMs: number, viewEndMs: number) {
  return ranges
    .filter((range) => range.endMs >= viewStartMs && range.startMs <= viewEndMs)
    .map((range) => ({
      startMs: Math.max(range.startMs, viewStartMs),
      endMs: Math.min(range.endMs, viewEndMs),
    }));
}

function renderRangeBlock(
  range: PlaybackTimeRange,
  index: number,
  baseStartMs: number,
  durationMs: number,
  variant: "overview-normal" | "overview-error" | "detail-normal" | "detail-error",
  compact = false,
) {
  const left = ((range.startMs - baseStartMs) / durationMs) * 100;
  const width = ((range.endMs - range.startMs) / durationMs) * 100;

  const className = {
    "overview-normal": "absolute top-1.5 bottom-1.5 rounded-lg bg-blue-300",
    "overview-error": "absolute top-1.5 bottom-1.5 z-10 rounded-lg bg-red-400",
    "detail-normal": cn("absolute rounded-lg border border-blue-300 bg-blue-200", compact ? "top-8 bottom-8" : "top-10 bottom-10"),
    "detail-error": cn("absolute z-10 rounded-lg border border-red-400 bg-red-300/90", compact ? "top-8 bottom-8" : "top-10 bottom-10"),
  }[variant];

  const minWidth = variant.startsWith("overview") ? 0.2 : 0.5;

  return (
    <div
      key={`${variant}-${range.startMs}-${range.endMs}-${index}`}
      className={className}
      style={{ left: `${left}%`, width: `${Math.max(width, minWidth)}%` }}
    />
  );
}

function formatAxisTime(timestampMs: number, viewDurationMs: number) {
  const date = new Date(timestampMs);
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return viewDurationMs <= 10 * 60 * 1000 ? `${hour}:${minute}:${second}` : `${hour}:${minute}`;
}

function formatDateTime(timestampMs: number) {
  const date = new Date(timestampMs);
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${hour}:${minute}:${second}`;
}
