"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import type { CompletionHabit } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export default function CompletionBarChart({ habits }: { habits: CompletionHabit[] }) {
  const chartData = {
    labels: habits.map((h) => h.title),
    datasets: [
      {
        label: "완료율 (%)",
        data: habits.map((h) => h.rate),
        backgroundColor: habits.map((h) =>
          h.rate >= 80 ? "#10b981" : h.rate >= 50 ? "#f59e0b" : "#ef4444"
        ),
        borderRadius: 4,
      },
    ],
  };

  const options = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { min: 0, max: 100 },
    },
    plugins: { legend: { display: false } },
  };

  return (
    <div style={{ height: `${Math.max(150, habits.length * 40)}px` }} aria-hidden="true">
      <Bar data={chartData} options={options} />
    </div>
  );
}
