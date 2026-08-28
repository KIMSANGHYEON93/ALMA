"use client";

import { useMemo } from "react";
import type { HeatmapData } from "@/lib/types";
import { summarizeHeatmap, formatHeatmapSummary } from "@/lib/a11y";

interface Props {
  data: HeatmapData | null;
}

export default function HabitHeatmap({ data }: Props) {
  const year = new Date().getFullYear();

  const { days, summaryText } = useMemo(() => {
    if (!data) {
      return { days: [] as { date: string; count: number }[], summaryText: "" };
    }
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const daysArr: { date: string; count: number }[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      daysArr.push({ date: key, count: data.dates[key] || 0 });
    }
    const summary = summarizeHeatmap(data.dates, year);
    return { days: daysArr, summaryText: formatHeatmapSummary(summary, year) };
  }, [data, year]);

  if (!data) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">연간 습관 히트맵</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">아직 기록이 없습니다. 습관을 체크인하면 이곳에 표시됩니다</p>
      </div>
    );
  }

  const getCellStyle = (count: number) => {
    if (count === 0) return "bg-gray-100 dark:bg-gray-800";
    if (count === 1) return "bg-emerald-200 dark:bg-emerald-900 ring-1 ring-emerald-400/70";
    if (count === 2) return "bg-emerald-400 dark:bg-emerald-700 ring-2 ring-emerald-600/80";
    return "bg-emerald-600 dark:bg-emerald-500 ring-2 ring-emerald-700 dark:ring-emerald-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-900";
  };

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">연간 습관 히트맵</h3>
      <div className="overflow-x-auto" role="img" aria-label={summaryText}>
        {/* 53주 × 7요일 = 371셀. 셀 w-3(12px) + gap 3px ≈ 15px × 53 = 795px.
            모바일(<768px)에서는 부모 overflow-x-auto로 가로 스크롤.
            minWidth는 작은 뷰포트에서 셀이 찌그러지지 않도록 최소 영역 보장. */}
        <div className="flex gap-[3px]" style={{ minWidth: "700px" }} aria-hidden="true">
          {Array.from({ length: 53 }, (_, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, dayIdx) => {
                const idx = weekIdx * 7 + dayIdx;
                const day = days[idx];
                if (!day) return <div key={dayIdx} className="w-3 h-3" />;
                return (
                  <div
                    key={dayIdx}
                    className={`w-3 h-3 rounded-sm ${getCellStyle(day.count)}`}
                    title={`${day.date}: ${day.count}개 완료`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-600 dark:text-gray-400">
        <span>적음</span>
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className={`w-3 h-3 rounded-sm ${getCellStyle(n)}`} aria-hidden="true" />
        ))}
        <span>많음</span>
      </div>
    </div>
  );
}
