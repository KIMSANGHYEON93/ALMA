"use client";

import type { CorrelationData } from "@/lib/types";
import { formatCorrelationSummary } from "@/lib/a11y";

interface Props {
  data: CorrelationData | null;
}

export default function HabitCorrelationMatrix({ data }: Props) {
  if (!data || data.pairs.length === 0) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">습관 상관관계</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">데이터가 부족합니다 (습관 2개 이상 + 5일 이상 기록 필요)</p>
      </div>
    );
  }

  const getStyle = (corr: number) => {
    if (corr >= 0.5) return { cls: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300", icon: "↑↑", label: "강한 양의 상관" };
    if (corr >= 0.2) return { cls: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400", icon: "↑", label: "양의 상관" };
    if (corr <= -0.5) return { cls: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300", icon: "↓↓", label: "강한 음의 상관" };
    if (corr <= -0.2) return { cls: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400", icon: "↓", label: "음의 상관" };
    return { cls: "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300", icon: "→", label: "상관 없음" };
  };

  const summary = formatCorrelationSummary(data.pairs);

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">습관 상관관계</h3>
      <span className="sr-only">{summary}</span>
      <div className="space-y-2" role="list">
        {data.pairs.map((pair, i) => {
          const style = getStyle(pair.correlation);
          return (
            <div
              key={i}
              role="listitem"
              className={`flex items-center justify-between p-2 rounded-lg ${style.cls}`}
              aria-label={`${pair.habit_a_title}와 ${pair.habit_b_title}: ${style.label}, 상관계수 ${pair.correlation.toFixed(2)}`}
            >
              <span className="text-sm">{pair.habit_a_title} ↔ {pair.habit_b_title}</span>
              <span className="flex items-center gap-1.5 text-sm font-mono font-medium">
                <span aria-hidden="true">{style.icon}</span>
                {pair.correlation.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
