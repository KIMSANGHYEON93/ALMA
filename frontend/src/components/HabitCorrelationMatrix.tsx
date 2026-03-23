"use client";

import type { CorrelationData } from "@/lib/types";

interface Props {
  data: CorrelationData | null;
}

export default function HabitCorrelationMatrix({ data }: Props) {
  if (!data || data.pairs.length === 0) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">습관 상관관계</h3>
        <p className="text-sm text-gray-400">데이터가 부족합니다 (습관 2개 이상 + 5일 이상 기록 필요)</p>
      </div>
    );
  }

  const getColor = (corr: number) => {
    if (corr >= 0.5) return "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300";
    if (corr >= 0.2) return "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400";
    if (corr <= -0.5) return "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300";
    if (corr <= -0.2) return "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400";
    return "bg-gray-50 dark:bg-gray-800 text-gray-500";
  };

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">습관 상관관계</h3>
      <div className="space-y-2">
        {data.pairs.map((pair, i) => (
          <div key={i} className={`flex items-center justify-between p-2 rounded-lg ${getColor(pair.correlation)}`}>
            <span className="text-sm">{pair.habit_a_title} ↔ {pair.habit_b_title}</span>
            <span className="text-sm font-mono font-medium">{pair.correlation.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
