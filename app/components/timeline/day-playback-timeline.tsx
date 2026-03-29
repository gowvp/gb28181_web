import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import type { PlaybackTimeRange } from "~/pages/recordings/time-mapping";

const MIN_WINDOW_MS = 60 * 1000;

export interface TimelineEventMarker {
  id: string;
  absoluteMs: number;
  imageSrc?: string | null;
  label: string;
  title?: string;
  subtitle?: string;
  count?: number;
  score?: number | null;
}

export interface DayPlaybackTimelineProps {
  dayStartMs: number;
  dayEndMs: number;
  ranges: PlaybackTimeRange[];
  errorRanges?: PlaybackTimeRange[];
  eventMarkers?: TimelineEventMarker[];
  eventRanges?: PlaybackTimeRange[];
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
  eventMarkers = [],
  eventRanges = [],
  currentTimeMs,
  onSeek,
  className,
  compact = false,
}: DayPlaybackTimelineProps) {
  const overviewRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverMs, setHoverMs] = useState<number | null>(null);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [activeEventRangeKey, setActiveEventRangeKey] = useState<string | null>(null);
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

  const visibleEventMarkers = useMemo(
    () =>
      eventMarkers.filter(
        (marker) => marker.absoluteMs >= viewStartMs && marker.absoluteMs <= viewEndMs,
      ),
    [eventMarkers, viewEndMs, viewStartMs],
  );

  const visibleEventRanges = useMemo(
    () => clipRangesToWindow(eventRanges, viewStartMs, viewEndMs),
    [eventRanges, viewEndMs, viewStartMs],
  );

  const findHoverEventState = useCallback(
    (clientX: number, element: HTMLDivElement | null, useFullDay = false) => {
      const markers = useFullDay ? eventMarkers : visibleEventMarkers;
      const rangesForHit = useFullDay ? eventRanges : visibleEventRanges;
      if (!element || markers.length === 0 || rangesForHit.length === 0) {
        return { marker: null, rangeKey: null };
      }

      const rect = element.getBoundingClientRect();
      if (rect.width <= 0) {
        return { marker: null, rangeKey: null };
      }

      const absoluteMs = getAbsoluteMsFromClientX(clientX, element, useFullDay);
      const duration = useFullDay ? totalDurationMs : viewDurationMs;
      const baseStart = useFullDay ? dayStartMs : viewStartMs;
      const msPerPx = duration / rect.width;
      const toleranceMs = Math.max(msPerPx * 10, 1200);

      const matchedRange = rangesForHit.find(
        (range) => absoluteMs >= range.startMs - toleranceMs && absoluteMs <= range.endMs + toleranceMs,
      );

      if (!matchedRange) {
        return { marker: null, rangeKey: null };
      }

      let marker: TimelineEventMarker | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const item of markers) {
        if (item.absoluteMs < matchedRange.startMs - toleranceMs || item.absoluteMs > matchedRange.endMs + toleranceMs) {
          continue;
        }

        const distance = Math.abs(item.absoluteMs - absoluteMs);
        if (distance < bestDistance) {
          bestDistance = distance;
          marker = item;
        }
      }

      if (!marker) {
        return { marker: null, rangeKey: null };
      }

      return {
        marker,
        rangeKey: `${baseStart}-${matchedRange.startMs}-${matchedRange.endMs}`,
      };
    },
    [dayStartMs, eventMarkers, eventRanges, getAbsoluteMsFromClientX, totalDurationMs, viewDurationMs, viewStartMs, visibleEventMarkers, visibleEventRanges],
  );

  const updatePointerState = useCallback(
    (clientX: number) => {
      const absoluteMs = getAbsoluteMsFromClientX(clientX, trackRef.current);
      const hoverState = findHoverEventState(clientX, trackRef.current);
      setHoverMs(absoluteMs);
      setActiveMarkerId(hoverState.marker?.id ?? null);
      setActiveEventRangeKey(hoverState.rangeKey);
      return absoluteMs;
    },
    [findHoverEventState, getAbsoluteMsFromClientX],
  );

  const handleOverviewClick = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const absoluteMs = getAbsoluteMsFromClientX(event.clientX, overviewRef.current, true);
      const centeredStart = absoluteMs - viewDurationMs / 2;
      const nextWindow = clampWindow(centeredStart, viewDurationMs);
      setViewStartMs(nextWindow.start);
      setViewEndMs(nextWindow.end);
      const hoverState = findHoverEventState(event.clientX, overviewRef.current, true);
      setActiveMarkerId(hoverState.marker?.id ?? null);
      setActiveEventRangeKey(hoverState.rangeKey);
      onSeek(absoluteMs);
    },
    [clampWindow, findHoverEventState, getAbsoluteMsFromClientX, onSeek, viewDurationMs],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const absoluteMs = updatePointerState(event.clientX);
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      onSeek(absoluteMs);
    },
    [onSeek, updatePointerState],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const absoluteMs = updatePointerState(event.clientX);
      if (isDragging) {
        onSeek(absoluteMs);
      }
    },
    [isDragging, onSeek, updatePointerState],
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

  const activeMarker = useMemo(
    () => eventMarkers.find((marker) => marker.id === activeMarkerId) ?? null,
    [activeMarkerId, eventMarkers],
  );

  const currentRatio = currentTimeMs
    ? (currentTimeMs - viewStartMs) / viewDurationMs
    : null;
  const overviewCurrentRatio = currentTimeMs
    ? (currentTimeMs - dayStartMs) / totalDurationMs
    : null;
  const overviewWindowLeft = ((viewStartMs - dayStartMs) / totalDurationMs) * 100;
  const overviewWindowWidth = (viewDurationMs / totalDurationMs) * 100;
  const hoverRatio = hoverMs !== null ? (hoverMs - viewStartMs) / viewDurationMs : null;
  const activeMarkerRatio = activeMarker
    ? (activeMarker.absoluteMs - viewStartMs) / viewDurationMs
    : null;
  const showHoverPreview = !compact && activeMarker && activeMarkerRatio !== null && activeMarkerRatio >= 0 && activeMarkerRatio <= 1;

  return (
    <div className={cn(compact ? "space-y-3" : "space-y-4", className)}>
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
          <span>{compact ? "概览" : "全天概览"}</span>
          <span>{formatDateTime(viewStartMs)} - {formatDateTime(viewEndMs)}</span>
        </div>
        <div
          ref={overviewRef}
          className={cn("relative cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-gray-50", compact ? "h-9" : "h-10")}
          onPointerDown={handleOverviewClick}
        >
          {ranges.map((range, index) => renderRangeBlock(range, index, dayStartMs, totalDurationMs, "overview-normal"))}
          {errorRanges.map((range, index) => renderRangeBlock(range, index, dayStartMs, totalDurationMs, "overview-error"))}
          {eventRanges.map((range, index) => renderRangeBlock(range, index, dayStartMs, totalDurationMs, "overview-event", false, `${dayStartMs}-${range.startMs}-${range.endMs}` === activeEventRangeKey))}
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
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-500">
          <span>{compact ? "拖动定位" : "点击、拖动定位，悬停橙色区间预览，滚轮缩放，Shift + 滚轮平移"}</span>
          <span>
            {activeMarker
              ? activeMarker.title ?? formatDateTime(activeMarker.absoluteMs)
              : hoverMs
                ? formatDateTime(hoverMs)
                : currentTimeMs
                  ? formatDateTime(currentTimeMs)
                  : "--:--:--"}
          </span>
        </div>

        <div className="relative overflow-visible">
          {showHoverPreview && activeMarker && activeMarkerRatio !== null && (
            <div
              className="pointer-events-none absolute bottom-full z-30 mb-3 w-56 -translate-x-1/2 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-xl"
              style={{
                left: `clamp(7rem, ${activeMarkerRatio * 100}%, calc(100% - 7rem))`,
              }}
            >
              {activeMarker.imageSrc ? (
                <img src={activeMarker.imageSrc} alt={activeMarker.title ?? "告警快照"} className="aspect-video w-full bg-black object-cover" />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-gray-900 px-3 text-center text-xs text-white/80">
                  当前告警暂无快照
                </div>
              )}
              <div className="space-y-1 border-t border-amber-100 px-3 py-2 text-xs text-gray-600">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-800">{activeMarker.title ?? "告警快照"}</span>
                  {typeof activeMarker.count === "number" && activeMarker.count > 1 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">{activeMarker.count} 个目标</span>
                  )}
                </div>
                <div className="text-gray-500">{activeMarker.subtitle ?? activeMarker.label}</div>
              </div>
            </div>
          )}

          <div
            ref={trackRef}
            className={cn("relative cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-white touch-none select-none", compact ? "h-24" : "h-28")}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => {
              handlePointerUp();
              setHoverMs(null);
              setActiveMarkerId(null);
              setActiveEventRangeKey(null);
            }}
            onPointerCancel={() => {
              handlePointerUp();
              setHoverMs(null);
              setActiveMarkerId(null);
              setActiveEventRangeKey(null);
            }}
            onDoubleClick={(event) => onSeek(getAbsoluteMsFromClientX(event.clientX, trackRef.current))}
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
            {visibleEventRanges.map((range, index) => renderRangeBlock(range, index, viewStartMs, viewDurationMs, "detail-event", compact, `${viewStartMs}-${range.startMs}-${range.endMs}` === activeEventRangeKey))}

            {hoverRatio !== null && hoverRatio >= 0 && hoverRatio <= 1 && (
              <div
                className="absolute top-0 bottom-0 z-10 w-px bg-blue-500/80"
                style={{ left: `${hoverRatio * 100}%` }}
              />
            )}

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
  variant:
    | "overview-normal"
    | "overview-error"
    | "overview-event"
    | "detail-normal"
    | "detail-error"
    | "detail-event",
  compact = false,
  active = false,
) {
  const left = ((range.startMs - baseStartMs) / durationMs) * 100;
  const width = ((range.endMs - range.startMs) / durationMs) * 100;

  const className = {
    "overview-normal": "absolute top-1.5 bottom-1.5 rounded-lg bg-blue-300",
    "overview-error": "absolute top-1.5 bottom-1.5 z-10 rounded-lg bg-red-400",
    "overview-event": cn("absolute top-1.5 bottom-1.5 z-20 rounded-lg bg-amber-400/90", active && "ring-2 ring-amber-200"),
    "detail-normal": cn("absolute rounded-lg border border-blue-300 bg-blue-200", compact ? "top-8 bottom-8" : "top-10 bottom-10"),
    "detail-error": cn("absolute z-10 rounded-lg border border-red-400 bg-red-300/90", compact ? "top-8 bottom-8" : "top-10 bottom-10"),
    "detail-event": cn(
      "absolute z-20 rounded-lg border border-amber-500/80 bg-amber-300/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]",
      compact ? "top-8 bottom-8" : "top-10 bottom-10",
      active && "bg-amber-400 ring-2 ring-amber-200",
    ),
  }[variant];

  const minWidth = variant.startsWith("overview") ? 0.2 : variant === "detail-event" ? 0.65 : 0.5;

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
