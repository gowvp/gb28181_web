import { useMemo, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface RecordingCalendarProps {
  /** 有录像的日期列表，格式为 "YYYY-MM-DD" */
  recordingDates: string[];
  /** 当前选中的日期 */
  selectedDate: Date;
  /** 日期选择回调 */
  onDateSelect: (date: Date) => void;
  /** 月份变化回调（用于加载该月的录像统计） */
  onMonthChange?: (year: number, month: number) => void;
  /** 是否加载中 */
  isLoading?: boolean;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 录像日历组件
 * 显示月历视图，标记有录像的日期
 */
export function RecordingCalendar({
  recordingDates,
  selectedDate,
  onDateSelect,
  onMonthChange,
  isLoading = false,
}: RecordingCalendarProps) {
  const [viewDate, setViewDate] = useState(() => {
    return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  });

  // 切换到上个月
  const goToPrevMonth = useCallback(() => {
    setViewDate((prev) => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      onMonthChange?.(newDate.getFullYear(), newDate.getMonth() + 1);
      return newDate;
    });
  }, [onMonthChange]);

  // 切换到下个月
  const goToNextMonth = useCallback(() => {
    setViewDate((prev) => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      onMonthChange?.(newDate.getFullYear(), newDate.getMonth() + 1);
      return newDate;
    });
  }, [onMonthChange]);

  // 回到今天
  const goToToday = useCallback(() => {
    const today = new Date();
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    onDateSelect(today);
    onMonthChange?.(today.getFullYear(), today.getMonth() + 1);
  }, [onDateSelect, onMonthChange]);

  // 生成日历网格
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // 当月第一天是星期几
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    // 当月有多少天
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // 上个月有多少天
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: {
      date: Date;
      day: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      hasRecording: boolean;
    }[] = [];

    // 填充上个月的日期
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const date = new Date(year, month - 1, day);
      days.push({
        date,
        day,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        hasRecording: false,
      });
    }

    // 填充当月日期
    const today = new Date();
    const todayStr = formatDate(today);
    const selectedStr = formatDate(selectedDate);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = formatDate(date);
      days.push({
        date,
        day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedStr,
        hasRecording: recordingDates.includes(dateStr),
      });
    }

    // 填充下个月的日期（补满 6 行）
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        day,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        hasRecording: false,
      });
    }

    return days;
  }, [viewDate, selectedDate, recordingDates]);

  // 格式化日期为 YYYY-MM-DD
  function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      {/* 头部：月份导航 */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={goToPrevMonth}
          disabled={isLoading}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">
            {viewDate.getFullYear()}年{viewDate.getMonth() + 1}月
          </span>
          <Button variant="outline" size="sm" onClick={goToToday}>
            今天
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={goToNextMonth}
          disabled={isLoading}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 星期标题 */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-500 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((dayInfo, index) => (
          <button
            key={index}
            type="button"
            className={cn(
              "relative aspect-square flex items-center justify-center rounded-lg text-sm transition-colors",
              dayInfo.isCurrentMonth
                ? "text-gray-900 hover:bg-gray-100"
                : "text-gray-300",
              dayInfo.isToday && "ring-2 ring-blue-400",
              dayInfo.isSelected && "bg-blue-500 text-white hover:bg-blue-600",
              !dayInfo.isCurrentMonth && "pointer-events-none",
            )}
            onClick={() => {
              if (dayInfo.isCurrentMonth) {
                onDateSelect(dayInfo.date);
              }
            }}
            disabled={!dayInfo.isCurrentMonth}
          >
            {dayInfo.day}
            {/* 有录像的标记（蓝色圆点） */}
            {dayInfo.hasRecording && !dayInfo.isSelected && (
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      )}
    </div>
  );
}

export default RecordingCalendar;
