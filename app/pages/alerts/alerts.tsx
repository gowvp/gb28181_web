import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { DatePicker, Modal, Select, Spin } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { AlertThumbnail } from "~/components/alerts/alert-thumbnail";
import { FindChannels, findChannelsKey } from "~/service/api/channel/channel";
import {
  FindEvents,
  GetEventImageUrl,
  findEventsKey,
} from "~/service/api/event/event";
import type { Event } from "~/service/api/event/state";

const { RangePicker } = DatePicker;
const PAGE_SIZE = 20;
/** 虚拟行固定高度（卡片图区 aspect-video + 文案区近似高度） */
const ROW_HEIGHT = 248;
/** 视口外多渲染的行数，减少快速滚动白屏 */
const VIRTUAL_OVERSCAN_ROWS = 3;

export default function AlertsView() {
  const { t } = useTranslation("common");
  const [searchParams] = useSearchParams();

  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null]>([
    null,
    null,
  ]);

  const labelOptions = [
    { label: t("all_labels"), value: "" },
    { label: t("label_person"), value: "person" },
    { label: t("label_cat"), value: "cat" },
    { label: t("label_car"), value: "car" },
    { label: t("label_dog"), value: "dog" },
  ];

  const [previewVisible, setPreviewVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const scrollRefCallback = useCallback((node: HTMLDivElement | null) => {
    scrollContainerRef.current = node;
    setScrollRoot(node);
  }, []);

  const [columnCount, setColumnCount] = useState(4);
  useEffect(() => {
    const updateCols = () => {
      const w = window.innerWidth;
      if (w >= 1280) {
        setColumnCount(5);
      } else if (w >= 1024) {
        setColumnCount(4);
      } else if (w >= 768) {
        setColumnCount(3);
      } else if (w >= 640) {
        setColumnCount(2);
      } else {
        setColumnCount(1);
      }
    };
    updateCols();
    window.addEventListener("resize", updateCols);
    return () => window.removeEventListener("resize", updateCols);
  }, []);

  useEffect(() => {
    const cid = searchParams.get("cid");
    if (cid) {
      setSelectedChannel(cid);
    }
  }, [searchParams]);

  const { data: channelsData } = useQuery({
    queryKey: [findChannelsKey, { page: 1, size: 1000 }],
    queryFn: () => FindChannels({ page: 1, size: 1000 }),
  });

  const channels = channelsData?.data?.items || [];

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
        0,
      );
      if (totalFetched < lastPage.total) {
        return allPages.length + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  const allEvents = useMemo(() => {
    return eventsData?.pages.flatMap((page) => page.items) || [];
  }, [eventsData]);

  const totalEvents = eventsData?.pages[0]?.total || 0;

  const rowCount = Math.max(0, Math.ceil(allEvents.length / columnCount));

  const [scrollTop, setScrollTop] = useState(0);
  const [layoutTick, setLayoutTick] = useState(0);

  const visibleRowRange = useMemo(() => {
    const el = scrollContainerRef.current;
    if (!el || rowCount === 0) {
      return { startRow: 0, endRow: -1 };
    }
    const viewH = el.clientHeight;
    const first = Math.floor(scrollTop / ROW_HEIGHT);
    const last = Math.ceil((scrollTop + viewH) / ROW_HEIGHT) - 1;
    const startRow = Math.max(0, first - VIRTUAL_OVERSCAN_ROWS);
    const endRow = Math.min(rowCount - 1, last + VIRTUAL_OVERSCAN_ROWS);
    return { startRow, endRow };
  }, [scrollTop, rowCount, layoutTick]);

  const totalListHeight = rowCount * ROW_HEIGHT;

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    setScrollTop(container.scrollTop);

    const { scrollTop: st, scrollHeight, clientHeight } = container;
    if (
      scrollHeight - st - clientHeight < 200 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    const ro = new ResizeObserver(() => {
      setLayoutTick((value) => value + 1);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      setScrollTop(container.scrollTop);
    }
  }, [allEvents.length, columnCount]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < allEvents.length - 1) {
      setCurrentIndex(currentIndex + 1);
      if (currentIndex >= allEvents.length - 3 && hasNextPage) {
        fetchNextPage();
      }
    }
  }, [currentIndex, allEvents.length, hasNextPage, fetchNextPage]);

  useEffect(() => {
    if (!previewVisible) {
      return;
    }

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

  const handleCardClick = (index: number) => {
    setCurrentIndex(index);
    setPreviewVisible(true);
  };

  const formatTime = (timestamp: number) => {
    return dayjs(timestamp).format("YYYY-MM-DD HH:mm:ss");
  };

  const formatLabel = (label: string) => {
    const labelMap: Record<string, string> = {
      person: t("label_person"),
      car: t("label_car"),
      cat: t("label_cat"),
      dog: t("label_dog"),
    };
    return labelMap[label] || label;
  };

  const currentEvent = allEvents[currentIndex];

  const visibleRows = useMemo(() => {
    const { startRow, endRow } = visibleRowRange;
    if (endRow < startRow) {
      return [];
    }
    return Array.from({ length: endRow - startRow + 1 }, (_, index) => startRow + index);
  }, [visibleRowRange]);

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white border-b border-gray-100">
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

        <Select
          placeholder={t("alert_filter_label")}
          allowClear
          style={{ minWidth: 120 }}
          value={selectedLabel || undefined}
          onChange={(value) => setSelectedLabel(value || "")}
          options={labelOptions}
        />

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

      <div ref={scrollRefCallback} className="flex-1 overflow-auto p-4 bg-gray-50/50">
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
            <div className="relative w-full" style={{ height: totalListHeight }}>
              {visibleRows.map((rowIndex) => (
                <div
                  key={rowIndex}
                  data-index={rowIndex}
                  className="absolute left-0 top-0 w-full px-0"
                  style={{
                    transform: `translateY(${rowIndex * ROW_HEIGHT}px)`,
                  }}
                >
                  <div
                    className="grid gap-4"
                    style={{
                      gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                    }}
                  >
                    {Array.from({ length: columnCount }).map((_, col) => {
                      const eventIndex = rowIndex * columnCount + col;
                      if (eventIndex >= allEvents.length) {
                        return (
                          <div
                            key={`pad-${rowIndex}-${col}`}
                            className="min-h-0"
                          />
                        );
                      }
                      const event = allEvents[eventIndex]!;
                      const imageUrl = GetEventImageUrl(event.image_path);
                      return (
                        <AlertCard
                          key={event.id}
                          event={event}
                          imageUrl={imageUrl}
                          scrollRoot={scrollRoot}
                          formatLabel={formatLabel}
                          formatTime={formatTime}
                          onOpen={() => handleCardClick(eventIndex)}
                          t={t}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <Spin />
              </div>
            )}
          </>
        )}
      </div>

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
            <button
              type="button"
              onClick={() => setPreviewVisible(false)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-all z-20"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="relative flex-1 flex items-center justify-center min-h-[400px] md:min-h-[600px] rounded-2xl overflow-hidden">
              <img
                src={GetEventImageUrl(currentEvent.image_path)}
                alt={currentEvent.label}
                className="w-full h-full max-h-[75vh] object-contain"
              />

              {currentIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/30 hover:bg-black/50 transition-all"
                >
                  <ChevronLeft className="w-7 h-7 text-white" />
                </button>
              )}

              {(currentIndex < allEvents.length - 1 || hasNextPage) && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/30 hover:bg-black/50 transition-all"
                >
                  <ChevronRight className="w-7 h-7 text-white" />
                </button>
              )}

              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/50 text-white text-sm font-medium">
                {currentIndex + 1} / {totalEvents}
              </div>
            </div>

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

function AlertCard({
  event,
  imageUrl,
  scrollRoot,
  formatLabel,
  formatTime,
  onOpen,
  t,
}: {
  event: Event;
  imageUrl: string;
  scrollRoot: HTMLElement | null;
  formatLabel: (label: string) => string;
  formatTime: (timestamp: number) => string;
  onOpen: () => void;
  t: (key: string) => string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-gray-200 min-w-0"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onOpen();
        }
      }}
    >
      <div className="relative">
        <AlertThumbnail
          originalUrl={imageUrl}
          scrollRoot={scrollRoot}
          alt={event.label}
        />
        <div className="pointer-events-none absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
          {formatLabel(event.label)}
        </div>
        <div className="pointer-events-none absolute top-2 right-2 rounded bg-emerald-500/80 px-2 py-0.5 text-xs text-white">
          {(event.score * 100).toFixed(0)}%
        </div>
      </div>
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
}

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
