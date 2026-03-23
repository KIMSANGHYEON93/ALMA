"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { TrendDay } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

export default function TrendLineChart({ daily }: { daily: TrendDay[] }) {
  const chartData = {
    labels: daily.map((d) => d.date.slice(5)),
    datasets: [
      {
        label: "완료율 (%)",
        data: daily.map((d) => d.rate),
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { min: 0, max: 100 },
    },
    plugins: { legend: { display: false } },
  };

  return (
    <div style={{ height: "200px" }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
