"use client";

import dynamic from "next/dynamic";
import type { TrendData } from "@/lib/types";
import { formatTrendSummary } from "@/lib/a11y";

const ChartComponent = dynamic(
  () => import("./charts/TrendLineChart"),
  { ssr: false }
);

interface Props {
  data: TrendData | null;
}

export default function HabitTrendChart({ data }: Props) {
  if (!data || data.daily.length === 0) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">완료율 트렌드</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">아직 기록이 없습니다. 습관을 체크인하면 완료율 추이가 표시됩니다</p>
      </div>
    );
  }
  const summary = formatTrendSummary(data.daily);
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">완료율 트렌드</h3>
      <div role="img" aria-label={summary}>
        <ChartComponent daily={data.daily} />
      </div>
    </div>
  );
}
