"use client";

import { useState } from "react";
import Link from "next/link";
import NavBar from "@/components/common/NavBar";
import Spinner from "@/components/common/Spinner";
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
    insight, loading, insightLoading, error, insightError,
    generateInsight, refresh,
  } = useHabitAnalytics(days);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="md" label="통계 로드 중" />
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
              <Link href="/habits" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">← 습관</Link>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">습관 통계</h1>
            </div>
            <div className="flex gap-1">
              {[30, 60, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1 text-xs rounded-lg transition ${
                    days === d
                      ? "bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400"
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {d}일
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mx-4 mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start justify-between gap-2"
            >
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              <button
                onClick={refresh}
                className="text-xs font-medium text-red-700 dark:text-red-300 hover:underline shrink-0"
              >
                다시 시도
              </button>
            </div>
          )}

          {insightError && (
            <div
              role="alert"
              className="mx-4 mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
            >
              <p className="text-sm text-red-700 dark:text-red-400">
                인사이트 생성 실패: {insightError}
              </p>
            </div>
          )}

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
