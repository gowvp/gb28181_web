import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Button, DatePicker, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Expand,
  Pause,
  Play,
  Shrink,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Mp4Player, { type Mp4PlayerRef } from "~/components/mp4-player";
import DayPlaybackTimeline, { type TimelineEventMarker } from "~/components/timeline/day-playback-timeline";
import { cn } from "~/lib/utils";
import {
  FindDevicesChannels,
  findDevicesChannelsKey,
} from "~/service/api/device/device";
import { FindEvents, findEventsKey, GetEventImageUrl } from "~/service/api/event/event";
import {
  FindRecordings,
  findRecordingsKey,
  GetMonthly,
  monthlyKey,
} from "~/service/api/recording/recording";
import type { Recording } from "~/service/api/recording/state";
import {
  buildMergedTimeRanges,
  buildPlaybackSegments,
  continuousSecondsToAbsoluteMs,
  formatBytes,
  formatDuration,
  getSegmentsTotalDuration,
  locateSegmentByAbsoluteMs,
  normalizeRecordings,
  parseBackendDateTime,
} from "./time-mapping";

const PAGE_SIZE = 30;
const EVENT_PAGE_SIZE = 200;

type SegmentIssue = {
  url: string;
  startMs: number;
  endMs: number;
  rawMessage: string;
};

/**
 * 为什么把日历单元格的值统一转换成 Dayjs：
 * antd 的 cellRender 类型在不同版本里会放宽成 string/number/Dayjs 联合类型，
 * 先收敛到同一种日期对象可以避免 UI 升级时把编译问题扩散到渲染逻辑里。
 */
function normalizeCalendarCellDate(value: string | number | Dayjs): Dayjs {
  return dayjs(value);
}

export default function RecordingDetailView() {
  const navigate = useNavigate();
  const playerRef = useRef<Mp4PlayerRef>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const initialChannelId = searchParams.get("cid") || "";
  const initialDateStr = searchParams.get("date") || formatDateForUrl(new Date());
  const initialDate = new Date(`${initialDateStr}T00:00:00`);

  const [channelId, setChannelId] = useState(initialChannelId);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [calendarPanelDate, setCalendarPanelDate] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [currentAbsoluteMs, setCurrentAbsoluteMs] = useState<number | null>(null);
  const [currentContinuousSec, setCurrentContinuousSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [segmentIssues, setSegmentIssues] = useState<SegmentIssue[]>([]);
  const [hideSegmentIssueNotice, setHideSegmentIssueNotice] = useState(false);
  const isMobileViewport = useIsMobileViewport();

  const { dayStartMs, dayEndMs } = useMemo(() => {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);
    return {
      dayStartMs: start.getTime(),
      dayEndMs: end.getTime(),
    };
  }, [selectedDate]);

  const updateUrl = useCallback((nextChannelId: string, nextDate: Date) => {
    const params = new URLSearchParams(window.location.search);
    if (nextChannelId) {
      params.set("cid", nextChannelId);
    } else {
      params.delete("cid");
    }
    params.set("date", formatDateForUrl(nextDate));
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, []);

  const { data: channelsData } = useQuery({
    queryKey: [findDevicesChannelsKey],
    queryFn: () => FindDevicesChannels({ page: 1, size: 100 }),
  });

  const allChannels = useMemo(() => {
    if (!channelsData?.data?.items) return [];
    const channels: Array<{ id: string; name: string; deviceName: string }> = [];
    for (const device of channelsData.data.items) {
      for (const channel of device.children || []) {
        channels.push({
          id: channel.id,
          name: channel.name || channel.channel_id || channel.id,
          deviceName: device.name || device.device_id,
        });
      }
    }
    return channels;
  }, [channelsData]);

  useEffect(() => {
    if (!channelId && allChannels.length > 0) {
      setChannelId(allChannels[0].id);
      updateUrl(allChannels[0].id, selectedDate);
    }
  }, [allChannels, channelId, selectedDate, updateUrl]);

  useEffect(() => {
    setCalendarPanelDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [selectedDate]);

  const { data: monthlyData } = useQuery({
    queryKey: [monthlyKey, channelId, calendarPanelDate.getFullYear(), calendarPanelDate.getMonth() + 1],
    queryFn: () =>
      GetMonthly({
        cid: channelId,
        year: calendarPanelDate.getFullYear(),
        month: calendarPanelDate.getMonth() + 1,
      }),
    enabled: !!channelId,
  });

  const monthRecordingDateSet = useMemo(
    () => buildMonthlyRecordingDateSet(calendarPanelDate, monthlyData?.data?.has_video || ""),
    [calendarPanelDate, monthlyData],
  );

  const monthRecordingDays = monthRecordingDateSet.size;

  const {
    data: recordingsResult,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [findRecordingsKey, "full-day", channelId, dayStartMs, dayEndMs],
    queryFn: () => fetchAllRecordings(channelId, dayStartMs, dayEndMs),
    enabled: !!channelId,
  });

  const { data: eventsResult } = useQuery({
    queryKey: [findEventsKey, "full-day", channelId, dayStartMs, dayEndMs],
    queryFn: () => fetchAllEvents(channelId, dayStartMs, dayEndMs),
    enabled: !!channelId,
  });

  const recordings = useMemo(
    () => normalizeRecordings(recordingsResult?.items || []),
    [recordingsResult],
  );
  const timeRanges = useMemo(() => buildMergedTimeRanges(recordings), [recordings]);
  const segments = useMemo(() => buildPlaybackSegments(recordings), [recordings]);
  const totalPlayableSeconds = useMemo(() => getSegmentsTotalDuration(segments), [segments]);
  const failedSegmentUrls = useMemo(
    () => segmentIssues.map((issue) => issue.url),
    [segmentIssues],
  );
  const latestSegmentIssue = segmentIssues.length > 0 ? segmentIssues[segmentIssues.length - 1] : null;
  const failedTimeRanges = useMemo(
    () =>
      buildMergedTimeRanges(
        segments
          .filter((segment) => failedSegmentUrls.includes(segment.url))
          .map((segment) => ({
            startMs: segment.startTime,
            endMs: segment.endTime ?? segment.startTime + segment.duration * 1000,
          })),
      ),
    [failedSegmentUrls, segments],
  );
  const totalSizeBytes = useMemo(
    () => recordings.reduce((sum, record) => sum + (record.size || 0), 0),
    [recordings],
  );
  const mergedCoverageSeconds = useMemo(
    () => timeRanges.reduce((sum, range) => sum + Math.max(range.endMs - range.startMs, 0) / 1000, 0),
    [timeRanges],
  );
  const normalizedEvents = useMemo(
    () => normalizeEventSnapshots(eventsResult?.items || []),
    [eventsResult],
  );
  const timelineEventMarkers = useMemo<TimelineEventMarker[]>(
    () => buildTimelineEventMarkers(normalizedEvents),
    [normalizedEvents],
  );
  const timelineEventRanges = useMemo(
    () => buildEventTimeRanges(normalizedEvents, dayStartMs, dayEndMs),
    [dayEndMs, dayStartMs, normalizedEvents],
  );

  useEffect(() => {
    setSegmentIssues([]);
    setPlayerError(null);
    setHideSegmentIssueNotice(false);
  }, [channelId, dayStartMs, dayEndMs]);

  useEffect(() => {
    if (segments.length === 0) {
      setCurrentAbsoluteMs(null);
      setCurrentContinuousSec(0);
      setPlayerError(null);
      setIsPlaying(false);
      return;
    }

    const currentInRange =
      currentAbsoluteMs !== null &&
      currentAbsoluteMs >= dayStartMs &&
      currentAbsoluteMs <= dayEndMs;

    if (!currentInRange) {
      const firstStart = segments[0].startTime;
      setCurrentAbsoluteMs(firstStart);
      setCurrentContinuousSec(0);
      playerRef.current?.seek(0, false);
      setPlayerError(null);
      return;
    }

    const located = locateSegmentByAbsoluteMs(segments, currentAbsoluteMs);
    if (located) {
      setCurrentAbsoluteMs(located.absoluteMs);
      setCurrentContinuousSec(located.continuousSeconds);
      playerRef.current?.seek(located.continuousSeconds, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, dayStartMs, dayEndMs]);

  useEffect(() => {
    playerRef.current?.setPlaybackRate(playbackRate);
  }, [playbackRate]);

  useEffect(() => {
    playerRef.current?.setMuted(isMuted);
  }, [isMuted]);

  useEffect(() => {
    playerRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const seekToAbsolute = useCallback(
    (absoluteMs: number, autoPlay = false) => {
      if (segments.length === 0) return;
      const located = locateSegmentByAbsoluteMs(segments, absoluteMs);
      if (!located) return;
      setCurrentAbsoluteMs(located.absoluteMs);
      setCurrentContinuousSec(located.continuousSeconds);
      setPlayerError(null);
      playerRef.current?.seek(located.continuousSeconds, autoPlay);
    },
    [segments],
  );

  const handlePlayPause = useCallback(() => {
    const player = playerRef.current;
    if (!player || segments.length === 0) return;

    if (player.isPlaying()) {
      player.pause();
      return;
    }

    if (player.getCurrentTime() > 0 || currentAbsoluteMs !== null) {
      player.resume();
      return;
    }

    seekToAbsolute(segments[0].startTime, true);
  }, [currentAbsoluteMs, seekToAbsolute, segments]);

  const skipSeconds = useCallback(
    (deltaSeconds: number) => {
      if (segments.length === 0) return;
      const currentSeconds = playerRef.current?.getCurrentTime() ?? currentContinuousSec;
      const nextSeconds = clamp(currentSeconds + deltaSeconds, 0, totalPlayableSeconds);
      seekToAbsolute(continuousSecondsToAbsoluteMs(segments, nextSeconds), isPlaying);
    },
    [currentContinuousSec, isPlaying, seekToAbsolute, segments, totalPlayableSeconds],
  );

  const toggleFullscreen = useCallback(async () => {
    const container = fullscreenRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      await container.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }, []);

  const handleChannelChange = useCallback(
    (value: string) => {
      setChannelId(value);
      setCurrentAbsoluteMs(null);
      setCurrentContinuousSec(0);
      updateUrl(value, selectedDate);
    },
    [selectedDate, updateUrl],
  );

  const handleDateChange = useCallback(
    (value: dayjs.Dayjs | null) => {
      if (!value) return;
      const nextDate = value.toDate();
      nextDate.setHours(0, 0, 0, 0);
      setSelectedDate(nextDate);
      setCalendarPanelDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      setDatePickerOpen(false);
      setCurrentAbsoluteMs(null);
      setCurrentContinuousSec(0);
      updateUrl(channelId, nextDate);
    },
    [channelId, updateUrl],
  );

  const goToPrevDay = useCallback(() => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() - 1);
    handleDateChange(dayjs(nextDate));
  }, [handleDateChange, selectedDate]);

  const goToNextDay = useCallback(() => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);
    handleDateChange(dayjs(nextDate));
  }, [handleDateChange, selectedDate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) return;
      if (segments.length === 0) return;

      if (event.code === "Space") {
        event.preventDefault();
        handlePlayPause();
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        skipSeconds(-5);
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        skipSeconds(5);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handlePlayPause, segments.length, skipSeconds]);

  const currentDisplayTime = currentAbsoluteMs
    ? new Date(currentAbsoluteMs).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "--:--:--";

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6">
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
              <Button type="text" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate("/playback")} />
              <span className="text-base font-semibold text-gray-900">录像回放</span>
            </div>

            <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(220px,320px)_auto_1fr]">
              <Select
                value={channelId || undefined}
                onChange={handleChannelChange}
                placeholder="选择通道"
                showSearch
                optionFilterProp="label"
                options={allChannels.map((channel) => ({
                  value: channel.id,
                  label: channel.name,
                  deviceName: channel.deviceName,
                }))}
                optionRender={(option) => (
                  <div className="flex flex-col py-1">
                    <span className="font-medium text-gray-900">{option.label}</span>
                    <span className="text-xs text-gray-400">{String(option.data.deviceName || "")}</span>
                  </div>
                )}
              />

              <div className="flex items-center gap-1">
                <Button type="text" icon={<ChevronLeft className="h-4 w-4" />} onClick={goToPrevDay} />
                <DatePicker
                  value={dayjs(selectedDate)}
                  pickerValue={dayjs(calendarPanelDate)}
                  onChange={handleDateChange}
                  onPanelChange={(value) => {
                    const nextPanelDate = value.toDate();
                    nextPanelDate.setDate(1);
                    nextPanelDate.setHours(0, 0, 0, 0);
                    setCalendarPanelDate(nextPanelDate);
                  }}
                  cellRender={(current, info) => {
                    if (info.type !== "date") {
                      return info.originNode;
                    }

                    const currentDate = normalizeCalendarCellDate(current);
                    const dateStr = currentDate.format("YYYY-MM-DD");
                    const hasRecording = monthRecordingDateSet.has(dateStr);
                    const isSelectedDate = currentDate.isSame(dayjs(selectedDate), "day");

                    return (
                      <div className="relative h-full w-full">
                        {info.originNode}
                        {hasRecording && (
                          <span
                            className={cn(
                              "pointer-events-none absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full",
                              isSelectedDate ? "bg-white/95" : "bg-blue-500",
                            )}
                          />
                        )}
                      </div>
                    );
                  }}
                  allowClear={false}
                  format="YYYY-MM-DD"
                  open={datePickerOpen}
                  onOpenChange={(open) => {
                    setDatePickerOpen(open);
                    if (open) {
                      setCalendarPanelDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
                    }
                  }}
                  suffixIcon={<Calendar className="h-4 w-4" />}
                />
                <Button type="text" icon={<ChevronRight className="h-4 w-4" />} onClick={goToNextDay} />
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                <span>本月有录像 {monthRecordingDays} 天</span>
                <span>当天片段 {recordings.length} 个</span>
                <span>可播放 {formatDuration(totalPlayableSeconds)}</span>
                <span>异常片段 {segmentIssues.length} 个</span>
                <span>告警快照 {timelineEventMarkers.length} 个</span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div ref={fullscreenRef} className={cn("flex flex-col", isFullscreen && "h-screen bg-white")}>
            <div className="aspect-video bg-black">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-300">正在加载当天录像...</div>
              ) : segments.length > 0 ? (
                <Mp4Player
                  ref={playerRef}
                  segments={segments}
                  className="h-full w-full"
                  controls={false}
                  autoPlay={false}
                  onTimeUpdate={(seconds) => {
                    const absoluteMs = continuousSecondsToAbsoluteMs(segments, seconds);
                    setCurrentContinuousSec(seconds);
                    setCurrentAbsoluteMs(absoluteMs);

                    if (!hideSegmentIssueNotice && segmentIssues.length > 0 && playerRef.current?.isPlaying()) {
                      const activeSegment = locateSegmentByAbsoluteMs(segments, absoluteMs);
                      if (activeSegment && !failedSegmentUrls.includes(activeSegment.segment.url)) {
                        setHideSegmentIssueNotice(true);
                      }
                    }
                  }}
                  onPlayStateChange={setIsPlaying}
                  onEnded={() => setIsPlaying(false)}
                  onError={(error) => {
                    if (!error.message.startsWith("片段播放失败:")) {
                      setPlayerError(getUserFriendlyPlayerMessage(error.message));
                    }
                  }}
                  onSegmentError={(segment, error) => {
                    setSegmentIssues((previous) => {
                      if (previous.some((item) => item.url === segment.url)) {
                        return previous;
                      }
                      return [
                        ...previous,
                        {
                          url: segment.url,
                          startMs: segment.startTime,
                          endMs: segment.endTime ?? segment.startTime + segment.duration * 1000,
                          rawMessage: error.message,
                        },
                      ];
                    });
                    setHideSegmentIssueNotice(false);
                    setPlayerError(null);
                  }}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-300">
                  <div className="text-lg font-medium text-white/90">当日没有可播放录像</div>
                  <div className="text-sm text-gray-400">请选择其他日期或切换通道</div>
                </div>
              )}
            </div>

            {isMobileViewport && (
              <div className="border-t border-gray-200 bg-white px-3 py-3 sm:px-4">
                <DayPlaybackTimeline
                  dayStartMs={dayStartMs}
                  dayEndMs={dayEndMs}
                  ranges={timeRanges}
                  errorRanges={failedTimeRanges}
                  eventMarkers={timelineEventMarkers}
                  eventRanges={timelineEventRanges}
                  currentTimeMs={currentAbsoluteMs}
                  onSeek={(absoluteMs) => seekToAbsolute(absoluteMs, isPlaying)}
                  compact
                />
              </div>
            )}

            <div className="border-t border-gray-200 bg-white px-3 py-3 sm:px-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="default"
                    icon={isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    onClick={handlePlayPause}
                    disabled={segments.length === 0}
                    className="px-3"
                    aria-label={isPlaying ? "Pause" : "Play"}
                    title={isPlaying ? "Pause" : "Play"}
                  />
                  <Button
                    icon={<SkipBack className="h-4 w-4" />}
                    onClick={() => skipSeconds(-5)}
                    disabled={segments.length === 0}
                    className="px-3"
                    aria-label="Back 5 seconds"
                    title="Back 5 seconds"
                  />
                  <Button
                    icon={<SkipForward className="h-4 w-4" />}
                    onClick={() => skipSeconds(5)}
                    disabled={segments.length === 0}
                    className="px-3"
                    aria-label="Forward 5 seconds"
                    title="Forward 5 seconds"
                  />
                  <Button
                    icon={isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    onClick={() => setIsMuted((value) => !value)}
                    disabled={segments.length === 0}
                    className="px-3"
                    aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
                    title={isMuted || volume === 0 ? "Unmute" : "Mute"}
                  />
                  <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={isMuted ? 0 : volume}
                      onChange={(event) => {
                        const nextVolume = Number(event.target.value);
                        setVolume(nextVolume);
                        if (nextVolume > 0 && isMuted) {
                          setIsMuted(false);
                        }
                      }}
                      className="w-24 sm:w-28"
                    />
                    <span className="w-10 text-right text-sm text-gray-500">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
                  </div>
                  <Select
                    value={playbackRate}
                    onChange={(value) => setPlaybackRate(Number(value))}
                    options={[
                      { value: 0.5, label: "0.5x" },
                      { value: 1, label: "1x" },
                      { value: 1.5, label: "1.5x" },
                      { value: 2, label: "2x" },
                    ]}
                    className="w-24"
                  />
                  <Button
                    icon={isFullscreen ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                    onClick={toggleFullscreen}
                    className="px-3"
                    aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                    title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm text-gray-500 xl:grid-cols-4">
                  <InfoBadge label="当前时间" value={currentDisplayTime} compact={isMobileViewport} />
                  <InfoBadge label="累计时长" value={formatDuration(currentContinuousSec)} compact={isMobileViewport} />
                  <InfoBadge label="录像覆盖" value={formatDuration(mergedCoverageSeconds)} compact={isMobileViewport} />
                  <InfoBadge label="文件总量" value={formatBytes(totalSizeBytes)} compact={isMobileViewport} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                {!isMobileViewport && <span>快捷键：Space 播放/暂停</span>}
                {!isMobileViewport && <span>← 后退 5 秒</span>}
                {!isMobileViewport && <span>→ 前进 5 秒</span>}
                {!isMobileViewport && <span>悬停时间轴可预览画面</span>}
                <span>蓝色：正常片段</span>
                <span>红色：异常片段</span>
                <span>橙色：AI事件</span>
                {isMobileViewport && <span>拖动时间轴可快速定位</span>}
                {isFetching && <span>正在刷新录像数据...</span>}
              </div>
            </div>
          </div>
        </div>

        {!isMobileViewport && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <DayPlaybackTimeline
              dayStartMs={dayStartMs}
              dayEndMs={dayEndMs}
              ranges={timeRanges}
              errorRanges={failedTimeRanges}
              eventMarkers={timelineEventMarkers}
              eventRanges={timelineEventRanges}
              currentTimeMs={currentAbsoluteMs}
              onSeek={(absoluteMs) => seekToAbsolute(absoluteMs, isPlaying)}
            />
          </div>
        )}

        {latestSegmentIssue && !hideSegmentIssueNotice && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            <div className="font-medium text-red-800">
              发现 {segmentIssues.length} 个异常片段，已自动跳过
            </div>
            <div className="mt-1 text-red-700">
              对应时间轴已标记为红色，请点击其他蓝色时间段继续播放。
            </div>
            <div className="mt-2 text-xs text-red-600">
              最近异常时段：{formatClockTime(latestSegmentIssue.startMs)} - {formatClockTime(latestSegmentIssue.endMs)}
            </div>
            <details className="mt-2 text-xs text-red-700">
              <summary className="cursor-pointer select-none">查看技术详情</summary>
              <div className="mt-2 break-all rounded-lg border border-red-100 bg-white/70 px-2 py-2 text-red-600">
                {latestSegmentIssue.rawMessage}
              </div>
            </details>
          </div>
        )}

        {!latestSegmentIssue && playerError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 shadow-sm">
            {playerError}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoBadge({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border border-gray-200 bg-gray-50", compact ? "px-3 py-2" : "px-3 py-2.5")}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className={cn("font-medium text-gray-700", compact ? "text-sm" : "text-base")}>{value}</div>
    </div>
  );
}



function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  return isMobile;
}

async function fetchAllRecordings(cid: string, startMs: number, endMs: number) {
  const items: Recording[] = [];
  let total = 0;

  for (let page = 1; page <= 500; page += 1) {
    const response = await FindRecordings({
      cid,
      start_ms: startMs,
      end_ms: endMs,
      page,
      size: PAGE_SIZE,
    });

    const pageItems = response.data?.items || [];
    total = response.data?.total || total;
    items.push(...pageItems);

    if (pageItems.length === 0 || items.length >= total || pageItems.length < PAGE_SIZE) {
      break;
    }
  }

  const deduped = Array.from(new Map(items.map((item) => [item.id, item])).values());
  return {
    items: deduped,
    total: total || deduped.length,
  };
}

function formatDateForUrl(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildMonthlyRecordingDateSet(monthDate: Date, bitmap: string) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const monthStart = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result = new Set<string>();

  for (let day = 1; day <= daysInMonth; day += 1) {
    if (bitmap[day - 1] !== "1") {
      continue;
    }

    const date = new Date(monthStart);
    date.setDate(day);
    result.add(formatDateForUrl(date));
  }

  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isEditableElement(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tagName = element.tagName;
  return (
    element.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    element.getAttribute("role") === "combobox"
  );
}

function getUserFriendlyPlayerMessage(message: string) {
  if (!message) {
    return "录像播放失败，请稍后重试或切换到其他时间段。";
  }

  const normalized = message.toLowerCase();

  if (normalized.includes("format error") || normalized.includes("src not supported") || normalized.includes("no supported sources")) {
    return "当前录像文件格式暂不支持播放，请切换到其他时间段。";
  }

  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "录像文件加载失败，请检查网络或稍后重试。";
  }

  return "录像播放失败，请稍后重试或切换到其他时间段。";
}

function formatClockTime(value: number) {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

async function fetchAllEvents(cid: string, startMs: number, endMs: number) {
  const items: Array<Record<string, unknown>> = [];
  let total = 0;

  for (let page = 1; page <= 200; page += 1) {
    const response = await FindEvents({
      cid,
      start_ms: startMs,
      end_ms: endMs,
      page,
      size: EVENT_PAGE_SIZE,
    });

    const pageItems = (response.data?.items || []) as Array<Record<string, unknown>>;
    total = response.data?.total || total;
    items.push(...pageItems);

    if (pageItems.length === 0 || items.length >= total || pageItems.length < EVENT_PAGE_SIZE) {
      break;
    }
  }

  return {
    items,
    total: total || items.length,
  };
}

type NormalizedEventSnapshot = {
  id: string;
  absoluteMs: number;
  imagePath: string;
  imageSrc: string;
  labels: string[];
  count: number;
  maxScore: number;
};

function normalizeEventSnapshots(items: Array<Record<string, unknown>>): NormalizedEventSnapshot[] {
  const grouped = new Map<string, {
    absoluteMs: number;
    imagePath: string;
    labels: string[];
    count: number;
    maxScore: number;
  }>();

  for (const item of items) {
    const imagePath = typeof item.image_path === "string" ? item.image_path.trim() : "";
    if (!imagePath) continue;

    const absoluteMs = parseBackendDateTime(item.started_at);
    if (!Number.isFinite(absoluteMs)) continue;

    const key = `${imagePath}::${absoluteMs}`;
    const label = typeof item.label === "string" && item.label.trim() ? item.label.trim() : "告警";
    const rawScore = typeof item.score === "number" ? item.score : Number(item.score ?? 0);
    const score = Number.isFinite(rawScore) ? rawScore : 0;

    const current = grouped.get(key) ?? {
      absoluteMs,
      imagePath,
      labels: [],
      count: 0,
      maxScore: 0,
    };

    current.count += 1;
    current.maxScore = Math.max(current.maxScore, score);
    if (!current.labels.includes(label)) {
      current.labels.push(label);
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .map(([key, value]) => ({
      id: key,
      absoluteMs: value.absoluteMs,
      imagePath: value.imagePath,
      imageSrc: GetEventImageUrl(value.imagePath),
      labels: value.labels,
      count: value.count,
      maxScore: value.maxScore,
    }))
    .sort((a, b) => a.absoluteMs - b.absoluteMs);
}

function buildTimelineEventMarkers(events: NormalizedEventSnapshot[]): TimelineEventMarker[] {
  return events.map((event) => ({
    id: event.id,
    absoluteMs: event.absoluteMs,
    imageSrc: event.imageSrc,
    label: event.labels[0] || "告警",
    title: `${formatClockTime(event.absoluteMs)} 告警快照`,
    subtitle: buildEventSubtitle(event),
    count: event.count,
    score: event.maxScore,
  }));
}

function buildEventTimeRanges(events: NormalizedEventSnapshot[], dayStartMs: number, dayEndMs: number) {
  if (events.length === 0) return [];

  const ranges = events
    .map((event) => ({
      startMs: Math.max(dayStartMs, event.absoluteMs - 1500),
      endMs: Math.min(dayEndMs, event.absoluteMs + 1500),
    }))
    .sort((a, b) => a.startMs - b.startMs);

  const merged: Array<{ startMs: number; endMs: number }> = [];
  const mergeGapMs = 10 * 1000;

  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range.startMs > last.endMs + mergeGapMs) {
      merged.push({ ...range });
      continue;
    }

    last.endMs = Math.max(last.endMs, range.endMs);
  }

  return merged;
}

function buildEventSubtitle(event: Pick<NormalizedEventSnapshot, "labels" | "count" | "maxScore">) {
  const labelText = event.labels.length > 2
    ? `${event.labels.slice(0, 2).join(" / ")} 等`
    : event.labels.join(" / ");
  const scoreText = event.maxScore > 0 ? ` · 最高置信度 ${Math.round(event.maxScore * 100)}%` : "";
  const countText = event.count > 1 ? ` · ${event.count} 个目标` : "";
  return `${labelText || "告警"}${countText}${scoreText}`;
}
