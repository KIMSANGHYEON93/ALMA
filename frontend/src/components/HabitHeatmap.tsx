"use client";

import type { HeatmapData } from "@/lib/types";

interface Props {
  data: HeatmapData | null;
}

export default function HabitHeatmap({ data }: Props) {
  if (!data) return null;

  const year = new Date().getFullYear();
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const days: { date: string; count: number }[] = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({ date: key, count: data.dates[key] || 0 });
  }

  const getColor = (count: number) => {
    if (count === 0) return "bg-gray-100 dark:bg-gray-800";
    if (count === 1) return "bg-emerald-200 dark:bg-emerald-900";
    if (count === 2) return "bg-emerald-400 dark:bg-emerald-700";
    return "bg-emerald-600 dark:bg-emerald-500";
  };

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">연간 습관 히트맵</h3>
      <div className="overflow-x-auto">
        <div className="flex gap-[2px]" style={{ minWidth: "700px" }}>
          {Array.from({ length: 53 }, (_, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-[2px]">
              {Array.from({ length: 7 }, (_, dayIdx) => {
                const idx = weekIdx * 7 + dayIdx;
                const day = days[idx];
                if (!day) return <div key={dayIdx} className="w-3 h-3" />;
                return (
                  <div
                    key={dayIdx}
                    className={`w-3 h-3 rounded-sm ${getColor(day.count)}`}
                    title={`${day.date}: ${day.count}개 완료`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
        <span>적음</span>
        <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800" />
        <div className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900" />
        <div className="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-700" />
        <div className="w-3 h-3 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
        <span>많음</span>
      </div>
    </div>
  );
}
