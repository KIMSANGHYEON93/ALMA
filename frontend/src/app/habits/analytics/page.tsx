"use client";

import { useState } from "react";
import Link from "next/link";
import NavBar from "@/components/common/NavBar";
import HabitHeatmap from "@/components/HabitHeatmap";
import HabitTrendChart from "@/components/HabitTrendChart";
import HabitCompletionChart from "@/components/HabitCompletionChart";
import HabitCorrelationMatrix from "@/components/HabitCorrelationMatrix";
import HabitInsightCard from "@/components/HabitInsightCard";
import { useAuth } from "@/contexts/AuthContext";
import { useHabitAnalytics } from "@/hooks/useHabitAnalytics";

export default function HabitAnalyticsPage() {
  const { isLoading: authLoading } = useAuth();
  const [days, setDays] = useState(30);
  const {
    heatmap, trends, completion, correlations,
    insight, loading, insightLoading, generateInsight,
  } = useHabitAnalytics(days);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-400">로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <NavBar />
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
        <div className="max-w-4xl mx-auto py-4">
          {/* Header */}
          <div className="px-4 flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link href="/habits" className="text-sm text-gray-400 hover:text-gray-600">← 습관</Link>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">습관 통계</h1>
            </div>
            <div className="flex gap-1">
              {[30, 60, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1 text-xs rounded-lg transition ${
                    days === d
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                      : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {d}일
                </button>
              ))}
            </div>
          </div>

          {/* Heatmap */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 mb-4 mx-4">
            <HabitHeatmap data={heatmap} />
          </div>

          {/* Trends + Completion */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 px-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800">
              <HabitTrendChart data={trends} />
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800">
              <HabitCompletionChart data={completion} />
            </div>
          </div>

          {/* Correlations */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 mb-4 mx-4">
            <HabitCorrelationMatrix data={correlations} />
          </div>

          {/* AI Insight */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 mb-4 mx-4">
            <HabitInsightCard insight={insight} loading={insightLoading} onGenerate={generateInsight} />
          </div>
        </div>
      </div>
    </div>
  );
}
