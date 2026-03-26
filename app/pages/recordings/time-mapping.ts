import { GetRecordingMp4Url } from "~/service/api/recording/recording";
import type { Recording } from "~/service/api/recording/state";

export type NormalizedRecording = Recording & {
  startMs: number;
  endMs: number;
  durationSec: number;
  url: string;
};

export type PlaybackTimeRange = {
  startMs: number;
  endMs: number;
};

export type PlaybackSegment = {
  id: number | string;
  url: string;
  duration: number;
  startTime: number;
  endTime: number;
  source: NormalizedRecording;
};

export type LocatedSegment = {
  index: number;
  segment: PlaybackSegment;
  absoluteMs: number;
  continuousSeconds: number;
  offsetSeconds: number;
  snapped: boolean;
};

const SECOND_MS = 1000;
const DEFAULT_MERGE_GAP_MS = 2000;

export function parseBackendDateTime(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return Number.NaN;
    return value < 1e12 ? value * 1000 : value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return Number.NaN;

    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed);
      return parseBackendDateTime(numeric);
    }

    const normalized = trimmed.includes("T")
      ? trimmed
      : trimmed.replace(" ", "T");
    const parsed = new Date(normalized).getTime();
    return Number.isNaN(parsed) ? Number.NaN : parsed;
  }

  return Number.NaN;
}

export function normalizeRecording(record: Recording): NormalizedRecording | null {
  const startMs = parseBackendDateTime(record.started_at);
  const endMs = parseBackendDateTime(record.ended_at);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }

  const safeEndMs = endMs > startMs ? endMs : startMs + SECOND_MS;
  const durationFromRange = (safeEndMs - startMs) / SECOND_MS;
  const durationSec = Math.max(record.duration || durationFromRange, durationFromRange, 1);

  return {
    ...record,
    startMs,
    endMs: safeEndMs,
    durationSec,
    url: GetRecordingMp4Url(record.path),
  };
}

export function normalizeRecordings(records: Recording[]): NormalizedRecording[] {
  return records
    .map((record) => normalizeRecording(record))
    .filter((record): record is NormalizedRecording => record !== null)
    .sort((a, b) => {
      if (a.startMs !== b.startMs) return a.startMs - b.startMs;
      if (a.endMs !== b.endMs) return a.endMs - b.endMs;
      return String(a.id).localeCompare(String(b.id));
    });
}

export function buildPlaybackSegments(
  records: NormalizedRecording[],
): PlaybackSegment[] {
  return records.map((record) => ({
    id: record.id,
    url: record.url,
    duration: record.durationSec,
    startTime: record.startMs,
    endTime: record.endMs,
    source: record,
  }));
}

export function buildMergedTimeRanges(
  records: Array<Pick<NormalizedRecording, "startMs" | "endMs">>,
  mergeGapMs = DEFAULT_MERGE_GAP_MS,
): PlaybackTimeRange[] {
  if (records.length === 0) return [];

  const sorted = [...records].sort((a, b) => a.startMs - b.startMs);
  const merged: PlaybackTimeRange[] = [];

  for (const record of sorted) {
    const current = merged[merged.length - 1];
    if (!current) {
      merged.push({ startMs: record.startMs, endMs: record.endMs });
      continue;
    }

    if (record.startMs <= current.endMs + mergeGapMs) {
      current.endMs = Math.max(current.endMs, record.endMs);
      continue;
    }

    merged.push({ startMs: record.startMs, endMs: record.endMs });
  }

  return merged;
}

export function locateSegmentByAbsoluteMs(
  segments: PlaybackSegment[],
  absoluteMs: number,
): LocatedSegment | null {
  if (segments.length === 0 || !Number.isFinite(absoluteMs)) {
    return null;
  }

  let accumulatedSeconds = 0;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];

    if (absoluteMs < segment.startTime) {
      if (index === 0) {
        return {
          index,
          segment,
          absoluteMs: segment.startTime,
          continuousSeconds: 0,
          offsetSeconds: 0,
          snapped: true,
        };
      }

      const previous = segments[index - 1];
      const previousAccumulated = accumulatedSeconds - previous.duration;
      const distanceToPreviousEnd = Math.abs(absoluteMs - previous.endTime);
      const distanceToCurrentStart = Math.abs(segment.startTime - absoluteMs);

      if (distanceToPreviousEnd <= distanceToCurrentStart) {
        return {
          index: index - 1,
          segment: previous,
          absoluteMs: previous.endTime,
          continuousSeconds: previousAccumulated + previous.duration,
          offsetSeconds: previous.duration,
          snapped: true,
        };
      }

      return {
        index,
        segment,
        absoluteMs: segment.startTime,
        continuousSeconds: accumulatedSeconds,
        offsetSeconds: 0,
        snapped: true,
      };
    }

    if (absoluteMs <= segment.endTime) {
      const offsetSeconds = (absoluteMs - segment.startTime) / SECOND_MS;
      return {
        index,
        segment,
        absoluteMs,
        continuousSeconds: accumulatedSeconds + offsetSeconds,
        offsetSeconds,
        snapped: false,
      };
    }

    accumulatedSeconds += segment.duration;
  }

  const lastIndex = segments.length - 1;
  const lastSegment = segments[lastIndex];
  const totalDuration = getSegmentsTotalDuration(segments);

  return {
    index: lastIndex,
    segment: lastSegment,
    absoluteMs: lastSegment.endTime,
    continuousSeconds: totalDuration,
    offsetSeconds: lastSegment.duration,
    snapped: true,
  };
}

export function absoluteMsToContinuousSeconds(
  segments: PlaybackSegment[],
  absoluteMs: number,
): number {
  const located = locateSegmentByAbsoluteMs(segments, absoluteMs);
  return located ? located.continuousSeconds : 0;
}

export function continuousSecondsToAbsoluteMs(
  segments: PlaybackSegment[],
  seconds: number,
): number {
  if (segments.length === 0) return Number.NaN;

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return segments[0].startTime;
  }

  let accumulated = 0;
  for (const segment of segments) {
    if (seconds <= accumulated + segment.duration) {
      return segment.startTime + (seconds - accumulated) * SECOND_MS;
    }
    accumulated += segment.duration;
  }

  return segments[segments.length - 1].endTime;
}

export function getSegmentsTotalDuration(segments: PlaybackSegment[]): number {
  return segments.reduce((sum, segment) => sum + segment.duration, 0);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
