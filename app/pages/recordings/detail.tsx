import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button, DatePicker, Segmented, Select } from "antd";
import dayjs from "dayjs";
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  FindDevicesChannels,
  findDevicesChannelsKey,
} from "~/service/api/device/device";
import {
  FindRecordings,
  findRecordingsKey,
  GetMonthly,
  GetRecordingMp4Url,
  monthlyKey,
} from "~/service/api/recording/recording";
import type { Recording } from "~/service/api/recording/state";
import { cn } from "~/lib/utils";

const PAGE_SIZE = 30;

/**
 * 录像详情页面
 * 默认显示网格视图，鼠标悬停自动播放预览，点击弹窗放大观看
 * 使用分页懒加载优化性能
 */
export default function RecordingDetailView() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 从 URL 获取参数
  const urlParams = new URLSearchParams(window.location.search);
  const initialChannelId = urlParams.get("cid") || "";
  const initialDateStr = urlParams.get("date");
  const initialDate = initialDateStr
    ? new Date(initialDateStr + "T00:00:00")
    : new Date();

  // 时间段筛选选项：全天、上午、下午、晚上
  type TimePeriod = "all" | "morning" | "afternoon" | "evening";

  // 状态
  const [channelId, setChannelId] = useState(initialChannelId);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");

  // 根据时间段计算当天的时间范围
  const { startTime, endTime } = useMemo(() => {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);

    switch (timePeriod) {
      case "morning": // 06:00 - 12:00
        start.setHours(6, 0, 0, 0);
        end.setHours(11, 59, 59, 999);
        break;
      case "afternoon": // 12:00 - 18:00
        start.setHours(12, 0, 0, 0);
        end.setHours(17, 59, 59, 999);
        break;
      case "evening": // 18:00 - 24:00 (次日 06:00)
        start.setHours(18, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      default: // all: 00:00 - 23:59
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    }
    return { startTime: start.getTime(), endTime: end.getTime() };
  }, [selectedDate, timePeriod]);

  // 查询所有通道
  const { data: channelsData } = useQuery({
    queryKey: [findDevicesChannelsKey],
    queryFn: () => FindDevicesChannels({ page: 1, size: 100 }),
  });

  // 扁平化所有通道列表
  const allChannels = useMemo(() => {
    if (!channelsData?.data?.items) return [];
    const channels: { id: string; name: string; deviceName: string }[] = [];
    for (const device of channelsData.data.items) {
      if (device.children) {
        for (const ch of device.children) {
          channels.push({
            id: ch.id,
            name: ch.name || ch.channel_id || ch.id,
            deviceName: device.name || device.device_id,
          });
        }
      }
    }
    return channels;
  }, [channelsData]);

  // 分页查询录像列表
  const {
    data: recordingsData,
    isLoading: isLoadingRecordings,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [findRecordingsKey, channelId, startTime, endTime],
    queryFn: ({ pageParam = 1 }) =>
      FindRecordings({
        cid: channelId,
        start_ms: startTime,
        end_ms: endTime,
        page: pageParam,
        size: PAGE_SIZE,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const total = lastPage.data?.total || 0;
      const loadedCount = allPages.reduce(
        (acc, page) => acc + (page.data?.items?.length || 0),
        0
      );
      if (loadedCount < total) {
        return allPages.length + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: !!channelId,
  });

  // 查询月度统计（用于日历标记）
  const { data: monthlyData } = useQuery({
    queryKey: [
      monthlyKey,
      channelId,
      selectedDate.getFullYear(),
      selectedDate.getMonth() + 1,
    ],
    queryFn: () =>
      GetMonthly({
        cid: channelId,
        year: selectedDate.getFullYear(),
        month: selectedDate.getMonth() + 1,
      }),
    enabled: !!channelId,
  });

  // 合并所有页的录像数据
  const recordings = useMemo(() => {
    if (!recordingsData?.pages) return [];
    return recordingsData.pages.flatMap((page) => page.data?.items || []);
  }, [recordingsData]);

  // 总数量
  const totalCount = recordingsData?.pages?.[0]?.data?.total || 0;

  // 解析月度统计
  const recordingDates = useMemo(() => {
    const data = monthlyData?.data;
    if (!data?.has_video) return [];

    const dates: string[] = [];
    const bitmap = data.has_video;
    for (let i = 0; i < bitmap.length; i++) {
      if (bitmap[i] === "1") {
        const day = (i + 1).toString().padStart(2, "0");
        const month = data.month.toString().padStart(2, "0");
        dates.push(`${data.year}-${month}-${day}`);
      }
    }
    return dates;
  }, [monthlyData]);

  // 今天是否有录像
  const todayHasRecording = useMemo(() => {
    const today = dayjs().format("YYYY-MM-DD");
    return recordingDates.includes(today);
  }, [recordingDates]);

  // 默认展开日期选择器（今天没有录像时）
  useEffect(() => {
    if (!isLoadingRecordings && recordings.length === 0 && !todayHasRecording) {
      setDatePickerOpen(true);
    }
  }, [isLoadingRecordings, recordings.length, todayHasRecording]);

  // 无限滚动加载
  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 切换通道
  const handleChannelChange = useCallback((value: string) => {
    setChannelId(value);
    const params = new URLSearchParams(window.location.search);
    params.set("cid", value);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, []);

  // 处理日期变更
  const handleDateChange = useCallback((date: dayjs.Dayjs | null) => {
    if (!date) return;
    const newDate = date.toDate();
    setSelectedDate(newDate);
    setDatePickerOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.set("date", formatDateForUrl(newDate));
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, []);

  // 日期导航
  const goToPrevDay = useCallback(() => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    handleDateChange(dayjs(prev));
  }, [selectedDate, handleDateChange]);

  const goToNextDay = useCallback(() => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    handleDateChange(dayjs(next));
  }, [selectedDate, handleDateChange]);

  // 返回录像列表
  const handleBack = useCallback(() => {
    navigate({ to: "/playback" });
  }, [navigate]);

  // 格式化时间显示（显示时分秒）
  const formatTime = (ms: number) => {
    if (!ms || Number.isNaN(ms)) return "--:--:--";
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return "--:--:--";
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // 格式化时长
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col overflow-hidden">
      {/* 顶部工具栏 */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 sticky top-0 z-10">
        <Button
          type="text"
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={handleBack}
        />

        {/* 通道切换 */}
        <Select
          value={channelId || undefined}
          onChange={handleChannelChange}
          placeholder={t("select_channel")}
          className="w-64"
          showSearch
          optionFilterProp="label"
          options={allChannels.map((ch) => ({
            value: ch.id,
            label: ch.name,
            desc: ch.deviceName,
          }))}
          optionRender={(option) => (
            <div className="flex flex-col py-1">
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-gray-400">{option.data.desc}</span>
            </div>
          )}
        />

        {/* 时间段快速筛选 */}
        <Segmented
          value={timePeriod}
          onChange={(value) => setTimePeriod(value as TimePeriod)}
          options={[
            { label: t("all_day"), value: "all" },
            { label: t("morning"), value: "morning" },
            { label: t("afternoon"), value: "afternoon" },
            { label: t("evening"), value: "evening" },
          ]}
          size="small"
        />

        <div className="flex-1" />

        {/* 录像数量 */}
        {totalCount > 0 && (
          <span className="text-sm text-gray-500">
            {recordings.length}/{totalCount} {t("segments")}
          </span>
        )}

        {/* 日期导航 */}
        <div className="flex items-center gap-1">
          <Button
            type="text"
            icon={<ChevronLeft className="w-4 h-4" />}
            onClick={goToPrevDay}
          />
          <DatePicker
            value={dayjs(selectedDate)}
            onChange={handleDateChange}
            open={datePickerOpen}
            onOpenChange={setDatePickerOpen}
            allowClear={false}
            format="YYYY-MM-DD"
            suffixIcon={<Calendar className="w-4 h-4" />}
            cellRender={(current) => {
              if (typeof current === "number" || typeof current === "string")
                return current;
              const d = current as dayjs.Dayjs;
              const dateStr = d.format("YYYY-MM-DD");
              const hasRecording = recordingDates.includes(dateStr);
              return (
                <div className="ant-picker-cell-inner relative">
                  {d.date()}
                  {hasRecording && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  )}
                </div>
              );
            }}
          />
          <Button
            type="text"
            icon={<ChevronRight className="w-4 h-4" />}
            onClick={goToNextDay}
          />
        </div>
      </div>

      {/* 主内容区域 - 网格视图 */}
      <div ref={containerRef} className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoadingRecordings ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
            {Array(12)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg overflow-hidden shadow-sm animate-pulse"
                >
                  <div className="aspect-video bg-gray-200" />
                  <div className="px-2 py-1.5 space-y-1">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                  </div>
                </div>
              ))}
          </div>
        ) : recordings.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
              {recordings.map((record) => (
                <RecordingCard
                  key={record.id}
                  record={record}
                  onClick={() => setSelectedRecording(record)}
                  formatTime={formatTime}
                  formatDuration={formatDuration}
                />
              ))}
            </div>
            {/* 加载更多触发器 */}
            <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                  <span className="text-sm">加载中...</span>
                </div>
              )}
              {!hasNextPage && recordings.length > 0 && (
                <span className="text-sm text-gray-400">已加载全部 {totalCount} 条录像</span>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-64 text-gray-500">
            <Video className="w-16 h-16 mb-4 text-gray-300" />
            <span className="text-lg">{t("no_recording")}</span>
            <span className="text-sm mt-2">{dayjs(selectedDate).format("YYYY-MM-DD")}</span>
          </div>
        )}
      </div>

      {/* 视频播放弹窗 */}
      {selectedRecording && (
        <VideoPlayerModal
          recording={selectedRecording}
          onClose={() => setSelectedRecording(null)}
          formatTime={formatTime}
          formatDuration={formatDuration}
        />
      )}
    </div>
  );
}

/**
 * 录像卡片组件 - 支持懒加载和悬停预览
 */
function RecordingCard({
  record,
  onClick,
  formatTime,
  formatDuration,
}: {
  record: Recording;
  onClick: () => void;
  formatTime: (ms: number) => string;
  formatDuration: (s: number) => string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const videoUrl = GetRecordingMp4Url(record.path);

  // 懒加载：只有卡片进入视口时才加载视频
  useEffect(() => {
    if (!cardRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  // 处理鼠标进入 - 开始播放预览
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
    if (previewRef.current && !hasError && isLoaded) {
      previewRef.current.currentTime = 0;
      previewRef.current.play().catch(() => {
        setHasError(true);
      });
    }
  }, [hasError, isLoaded]);

  // 处理鼠标离开 - 暂停预览
  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    if (previewRef.current) {
      previewRef.current.pause();
      previewRef.current.currentTime = 0;
    }
  }, []);

  return (
    <div
      ref={cardRef}
      className="bg-white rounded-lg overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 视频预览区域 */}
      <div className="aspect-video bg-gray-900 relative overflow-hidden">
        {isVisible ? (
          <>
            {/* 视频预览 */}
            <video
              ref={previewRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              muted
              loop
              playsInline
              preload="metadata"
              onLoadedData={() => setIsLoaded(true)}
              onError={() => setHasError(true)}
            />

            {/* 加载中状态 */}
            {!isLoaded && !hasError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
              </div>
            )}

            {/* 错误状态 */}
            {hasError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <Video className="w-8 h-8 text-gray-500" />
              </div>
            )}
          </>
        ) : (
          // 占位符
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <Video className="w-8 h-8 text-gray-600" />
          </div>
        )}

        {/* 时长标签 */}
        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
          {formatDuration(record.duration)}
        </div>
      </div>

      {/* 信息区域 - 更紧凑 */}
      <div className="px-2 py-1.5">
        <div className="text-xs text-gray-700">
          {formatTime(record.started_at)} - {formatTime(record.ended_at)}
        </div>
      </div>
    </div>
  );
}

/**
 * 视频播放弹窗组件
 * 支持 0.5/1/2/3 倍速、全屏、暂停/播放、键盘快捷键
 */
function VideoPlayerModal({
  recording,
  onClose,
  formatTime,
  formatDuration,
}: {
  recording: Recording;
  onClose: () => void;
  formatTime: (ms: number) => string;
  formatDuration: (s: number) => string;
}) {
  const { t } = useTranslation("common");
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  const videoUrl = GetRecordingMp4Url(recording.path);
  const speedOptions = [0.5, 1, 2, 3];

  // 自动播放
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(console.warn);
    }
  }, []);

  // 时间更新
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  // 元数据加载
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  // 播放/暂停切换
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(console.warn);
    }
  }, [isPlaying]);

  // 静音切换
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  // 设置倍速
  const setSpeed = useCallback((speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackRate(speed);
    }
  }, []);

  // 后退 5 秒
  const goBack5Seconds = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
    }
  }, []);

  // 前进 5 秒
  const goForward5Seconds = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(
        videoRef.current.duration,
        videoRef.current.currentTime + 5
      );
    }
  }, []);

  // 进度条点击
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = percent * duration;
  }, [duration]);

  // 全屏切换
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goBack5Seconds();
          break;
        case "ArrowRight":
          e.preventDefault();
          goForward5Seconds();
          break;
        case "Escape":
          if (!document.fullscreenElement) {
            onClose();
          }
          break;
        case "KeyM":
          toggleMute();
          break;
        case "KeyF":
          toggleFullscreen();
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, goBack5Seconds, goForward5Seconds, onClose, toggleMute, toggleFullscreen]);

  // 自动隐藏控制栏
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  // 鼠标移动时显示控制栏
  const handleMouseMove = useCallback(() => {
    resetHideTimer();
  }, [resetHideTimer]);

  // 格式化秒数为 mm:ss
  const formatSeconds = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div
        ref={containerRef}
        className="relative w-full h-full max-w-6xl max-h-[90vh] bg-black flex flex-col"
        onMouseMove={handleMouseMove}
      >
        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-opacity cursor-pointer",
            showControls ? "opacity-100" : "opacity-0"
          )}
        >
          <X className="w-6 h-6" />
        </button>

        {/* 视频 */}
        <div className="flex-1 flex items-center justify-center">
          <video
            ref={videoRef}
            src={videoUrl}
            className="max-w-full max-h-full"
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onClick={togglePlay}
          />
        </div>

        {/* 控制栏 */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity",
            showControls ? "opacity-100" : "opacity-0"
          )}
        >
          {/* 进度条 */}
          <div
            className="h-1 bg-white/30 rounded-full cursor-pointer mb-4 group"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-blue-500 rounded-full relative"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center gap-3">
            {/* 后退 5 秒 */}
            <button
              type="button"
              onClick={goBack5Seconds}
              className="p-2 text-white hover:text-blue-400 transition-colors cursor-pointer"
              title="后退 5 秒 (←)"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* 播放/暂停 */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-2 text-white hover:text-blue-400 transition-colors cursor-pointer"
              title="播放/暂停 (空格)"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6" />
              )}
            </button>

            {/* 前进 5 秒 */}
            <button
              type="button"
              onClick={goForward5Seconds}
              className="p-2 text-white hover:text-blue-400 transition-colors cursor-pointer"
              title="前进 5 秒 (→)"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            {/* 静音 */}
            <button
              type="button"
              onClick={toggleMute}
              className="p-2 text-white hover:text-blue-400 transition-colors cursor-pointer"
              title="静音 (M)"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>

            {/* 时间 */}
            <span className="text-white text-sm font-mono">
              {formatSeconds(currentTime)} / {formatSeconds(duration)}
            </span>

            <div className="flex-1" />

            {/* 倍速选择 */}
            <div className="flex items-center gap-1">
              {speedOptions.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => setSpeed(speed)}
                  className={cn(
                    "px-2 py-1 text-sm rounded transition-colors cursor-pointer",
                    playbackRate === speed
                      ? "bg-blue-500 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/20"
                  )}
                >
                  {speed}x
                </button>
              ))}
            </div>

            {/* 全屏 */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 text-white hover:text-blue-400 transition-colors cursor-pointer"
              title="全屏 (F)"
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* 录像信息 */}
          <div className="text-white/60 text-xs mt-2">
            {formatTime(recording.started_at)} - {formatTime(recording.ended_at)} · {formatDuration(recording.duration)}
          </div>
        </div>
      </div>
    </div>
  );
}

// 辅助函数
function formatDateForUrl(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}
