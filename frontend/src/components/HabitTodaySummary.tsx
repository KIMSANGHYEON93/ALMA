"use client";

import type { TodaySummary } from "@/lib/types";

interface Props {
  summary: TodaySummary | null;
}

export default function HabitTodaySummary({ summary }: Props) {
  if (!summary) return null;

  const pct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

  return (
    <div className="p-4 border-b dark:border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">오늘의 습관</span>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {summary.completed}/{summary.total} 완료
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-emerald-500 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
