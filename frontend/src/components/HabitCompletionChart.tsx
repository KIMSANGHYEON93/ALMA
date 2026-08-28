"use client";

import dynamic from "next/dynamic";
import type { CompletionData } from "@/lib/types";
import { formatCompletionSummary } from "@/lib/a11y";

const ChartComponent = dynamic(
  () => import("./charts/CompletionBarChart"),
  { ssr: false }
);

interface Props {
  data: CompletionData | null;
}

export default function HabitCompletionChart({ data }: Props) {
  if (!data || data.habits.length === 0) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">습관별 완료율</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">아직 기록이 없습니다. 습관을 체크인하면 완료율이 표시됩니다</p>
      </div>
    );
  }
  const summary = formatCompletionSummary(data.habits);
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">습관별 완료율</h3>
      <div role="img" aria-label={summary}>
        <ChartComponent habits={data.habits} />
      </div>
    </div>
  );
}
