"use client";

import dynamic from "next/dynamic";
import type { CompletionData } from "@/lib/types";

const ChartComponent = dynamic(
  () => import("./charts/CompletionBarChart"),
  { ssr: false }
);

interface Props {
  data: CompletionData | null;
}

export default function HabitCompletionChart({ data }: Props) {
  if (!data || data.habits.length === 0) return null;
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">습관별 완료율</h3>
      <ChartComponent habits={data.habits} />
    </div>
  );
}
