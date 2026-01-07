import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { DatePicker, Modal, Select, Spin } from "antd";
import { Masonry } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FindChannels, findChannelsKey } from "~/service/api/channel/channel";
import {
  FindEvents,
  GetEventImageUrl,
  findEventsKey,
} from "~/service/api/event/event";
import type { Event } from "~/service/api/event/state";

const { RangePicker } = DatePicker;
const PAGE_SIZE = 20;

export default function AlertsView() {
  const { t } = useTranslation("common");

  // 筛选状态
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null]>([
    null,
    null,
  ]);

  // 标签选项
  const labelOptions = [
    { label: t("all_labels"), value: "" },
    { label: t("label_person"), value: "person" },
    { label: t("label_cat"), value: "cat" },
    { label: t("label_car"), value: "car" },
    { label: t("label_dog"), value: "dog" },
  ];

  // 预览状态
  const [previewVisible, setPreviewVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 获取通道列表
  const { data: channelsData } = useQuery({
    queryKey: [findChannelsKey, { page: 1, size: 1000 }],
    queryFn: () => FindChannels({ page: 1, size: 1000 }),
  });

  const channels = channelsData?.data?.items || [];

  // 构建查询参数
  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = {
      size: PAGE_SIZE,
    };
    if (selectedChannel) {
      params.cid = selectedChannel;
    }
    if (selectedLabel) {
      params.label = selectedLabel;
    }
    if (timeRange[0]) {
      params.start_ms = timeRange[0].startOf("day").valueOf();
    }
    if (timeRange[1]) {
      params.end_ms = timeRange[1].endOf("day").valueOf();
    }
    return params;
  }, [selectedChannel, selectedLabel, timeRange]);

  // 无限滚动查询事件列表
  const {
    data: eventsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: [findEventsKey, queryParams],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await FindEvents({
        ...queryParams,
        page: pageParam,
        size: PAGE_SIZE,
      });
      return res.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce(
        (sum, page) => sum + page.items.length,
        0
      );
      if (totalFetched < lastPage.total) {
        return allPages.length + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  // 合并所有页面的事件
  const allEvents = useMemo(() => {
    return eventsData?.pages.flatMap((page) => page.items) || [];
  }, [eventsData]);

  // 事件总数
  const totalEvents = eventsData?.pages[0]?.total || 0;

  // 滚动到底部时加载更多
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // 当滚动到距离底部 200px 时触发加载
    if (
      scrollHeight - scrollTop - clientHeight < 200 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  // 预览时切换到上一条/下一条
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < allEvents.length - 1) {
      setCurrentIndex(currentIndex + 1);
      // 当接近最后一条时自动加载更多
      if (currentIndex >= allEvents.length - 3 && hasNextPage) {
        fetchNextPage();
      }
    }
  }, [currentIndex, allEvents.length, hasNextPage, fetchNextPage]);

  // 键盘导航
  useEffect(() => {
    if (!previewVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "Escape") {
        setPreviewVisible(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewVisible, handlePrev, handleNext]);

  // 点击卡片打开预览
  const handleCardClick = (index: number) => {
    setCurrentIndex(index);
    setPreviewVisible(true);
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss");
  };

  // 格式化标签显示
  const formatLabel = (label: string) => {
    const labelMap: Record<string, string> = {
      person: t("label_person"),
      car: t("label_car"),
      cat: t("label_cat"),
      dog: t("label_dog"),
    };
    return labelMap[label] || label;
  };

  // 当前预览的事件
  const currentEvent = allEvents[currentIndex];

  // Masonry items 配置 - 使用 data 存储事件数据和索引
  const masonryItems = allEvents.map((event, index) => ({
    key: event.id,
    data: { event, index },
  }));

  // 使用 itemRender 统一渲染卡片
  const renderItem = (item: {
    key: React.Key;
    data: { event: Event; index: number };
    index: number;
  }) => {
    const { event, index: eventIndex } = item.data;
    return (
      <div
        className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-gray-200"
        onClick={() => handleCardClick(eventIndex)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleCardClick(eventIndex);
          }
        }}
      >
        {/* 图片 */}
        <div className="relative aspect-video bg-gray-100">
          <img
            src={GetEventImageUrl(event.image_path)}
            alt={event.label}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* 标签角标 */}
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded">
            {formatLabel(event.label)}
          </div>
          {/* 置信度 */}
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-500/80 text-white text-xs rounded">
            {(event.score * 100).toFixed(0)}%
          </div>
        </div>
        {/* 信息 */}
        <div className="p-3 space-y-1">
          <div className="text-sm text-gray-600 truncate">
            {t("alert_channel")}: {event.cid}
          </div>
          <div className="text-xs text-gray-400">
            {formatTime(event.started_at)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white border-b border-gray-100">
        {/* 通道筛选 - 使用 id 作为 cid 进行筛选 */}
        <Select
          placeholder={t("alert_filter_channel")}
          allowClear
          style={{ minWidth: 180 }}
          value={selectedChannel || undefined}
          onChange={(value) => setSelectedChannel(value || "")}
          options={[
            { label: t("all_channels"), value: "" },
            ...channels.map((ch) => ({
              label: ch.name || ch.channel_id,
              value: ch.id,
            })),
          ]}
        />

        {/* 类型筛选 */}
        <Select
          placeholder={t("alert_filter_label")}
          allowClear
          style={{ minWidth: 120 }}
          value={selectedLabel || undefined}
          onChange={(value) => setSelectedLabel(value || "")}
          options={labelOptions}
        />

        {/* 时间范围 */}
        <RangePicker
          placeholder={[t("alert_filter_time"), t("alert_filter_time")]}
          value={timeRange}
          onChange={(dates) =>
            setTimeRange(dates ? [dates[0], dates[1]] : [null, null])
          }
          presets={[
            {
              label: t("today"),
              value: [dayjs().startOf("day"), dayjs().endOf("day")],
            },
            {
              label: t("yesterday"),
              value: [
                dayjs().subtract(1, "day").startOf("day"),
                dayjs().subtract(1, "day").endOf("day"),
              ],
            },
            {
              label: t("last_7_days"),
              value: [dayjs().subtract(7, "day").startOf("day"), dayjs()],
            },
            {
              label: t("last_30_days"),
              value: [dayjs().subtract(30, "day").startOf("day"), dayjs()],
            },
          ]}
        />

        {/* 刷新按钮 */}
        <button
          type="button"
          onClick={() => refetch()}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title={t("refresh")}
        >
          <RefreshCw
            className={`w-5 h-5 text-gray-600 ${
              isLoading ? "animate-spin" : ""
            }`}
          />
        </button>
      </div>

      {/* 瀑布流内容区 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-4 bg-gray-50/50"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Spin size="large" />
          </div>
        ) : allEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="text-lg">{t("alert_no_events")}</div>
          </div>
        ) : (
          <>
            <Masonry
              columns={{ xs: 1, sm: 2, md: 3, lg: 4, xl: 5 }}
              gutter={16}
              items={masonryItems}
              itemRender={renderItem}
            />
            {/* 加载更多指示器 */}
            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <Spin />
              </div>
            )}
          </>
        )}
      </div>

      {/* 预览弹窗 */}
      <Modal
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width="90vw"
        style={{ maxWidth: 1200, top: "10%" }}
        styles={{
          body: { padding: 0, borderRadius: 16, overflow: "hidden" },
        }}
        closeIcon={null}
      >
        {currentEvent && (
          <div className="relative flex flex-col md:flex-row">
            {/* 关闭按钮 - 弹窗右上角 */}
            <button
              type="button"
              onClick={() => setPreviewVisible(false)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-all z-20"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* 左侧：图片区域 - 无背景，图片自适应占满 */}
            <div className="relative flex-1 flex items-center justify-center min-h-[400px] md:min-h-[600px] rounded-2xl overflow-hidden">
              {/* 图片 - 无边距，自适应占满 */}
              <img
                src={GetEventImageUrl(currentEvent.image_path)}
                alt={currentEvent.label}
                className="w-full h-full max-h-[75vh] object-contain"
              />

              {/* 导航按钮 - 上一条（没有上一页时隐藏） */}
              {currentIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/30 hover:bg-black/50 transition-all"
                >
                  <ChevronLeft className="w-7 h-7 text-white" />
                </button>
              )}

              {/* 导航按钮 - 下一条（没有下一页时隐藏） */}
              {(currentIndex < allEvents.length - 1 || hasNextPage) && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/30 hover:bg-black/50 transition-all"
                >
                  <ChevronRight className="w-7 h-7 text-white" />
                </button>
              )}

              {/* 计数器 - 显示真实总数 */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/50 text-white text-sm font-medium">
                {currentIndex + 1} / {totalEvents}
              </div>
            </div>

            {/* 右侧：详情信息 */}
            <div className="w-full md:w-80 p-6 bg-white space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">
                {t("alerts")}
              </h3>

              <div className="space-y-3">
                <InfoRow
                  label={t("alert_label")}
                  value={formatLabel(currentEvent.label)}
                />
                <InfoRow
                  label={t("alert_confidence")}
                  value={`${(currentEvent.score * 100).toFixed(1)}%`}
                />
                <InfoRow label={t("alert_channel")} value={currentEvent.cid} />
                <InfoRow
                  label={t("alert_device")}
                  value={currentEvent.did || "-"}
                />
                <InfoRow
                  label={t("alert_started_at")}
                  value={formatTime(currentEvent.started_at)}
                />
                {currentEvent.ended_at > 0 && (
                  <InfoRow
                    label={t("alert_ended_at")}
                    value={formatTime(currentEvent.ended_at)}
                  />
                )}
                <InfoRow
                  label={t("alert_model")}
                  value={currentEvent.model || "-"}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// 信息行组件
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="text-gray-900 text-sm text-right max-w-[60%] break-all">
        {value}
      </span>
    </div>
  );
}
