"use client";

import Link from "next/link";
import NavBar from "@/components/common/NavBar";
import Spinner from "@/components/common/Spinner";
import RetrospectiveCard from "@/components/RetrospectiveCard";
import InsightCard from "@/components/InsightCard";
import { useAuth } from "@/contexts/AuthContext";
import { useInsights } from "@/hooks/useInsights";

export default function InsightsPage() {
  const { isLoading: authLoading } = useAuth();
  const {
    dashboard,
    retrospectives,
    loading,
    generating,
    error,
    generateError,
    generateRetrospective,
    refresh,
  } = useInsights();

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="md" label="인사이트 로드 중" />
      </div>
    );
  }

  const stats = dashboard?.stats;
  const hasAnyData =
    (stats?.active_goals || 0) +
      (stats?.completed_goals || 0) +
      (stats?.streak_days || 0) >
    0;

  return (
    <div className="flex flex-col h-screen">
      <NavBar />
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              인사이트
            </h1>
            <button
              onClick={generateRetrospective}
              disabled={generating}
              className="px-4 py-2 text-sm bg-sky-700 text-white rounded-lg hover:bg-sky-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {generating ? "분석 중..." : "주간 회고 생성"}
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start justify-between gap-2"
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

          {generateError && (
            <div
              role="alert"
              className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
            >
              <p className="text-sm text-red-700 dark:text-red-400">
                회고 생성 실패: {generateError}
              </p>
            </div>
          )}

          {/* Stats */}
          {stats && hasAnyData && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">
                  {stats.active_goals}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">진행 중 목표</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4 text-center">
                <p className="text-2xl font-bold text-sky-700">
                  {stats.completed_goals}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">완료 목표</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4 text-center">
                <p className="text-2xl font-bold text-orange-500">
                  {stats.streak_days}일
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">연속 활동</p>
              </div>
            </div>
          )}

          {!hasAnyData && !error && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-6 text-center">
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                아직 데이터가 부족합니다
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                목표를 만들고 습관을 기록하면 인사이트가 생성됩니다
              </p>
              <div className="flex items-center justify-center gap-2">
                <Link
                  href="/goals"
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/50"
                >
                  목표 만들기
                </Link>
                <Link
                  href="/habits"
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                >
                  습관 만들기
                </Link>
              </div>
            </div>
          )}

          {/* Latest Retrospective */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              최근 회고
            </h2>
            {retrospectives.length > 0 ? (
              <div className="space-y-4">
                {retrospectives.map((retro) => (
                  <RetrospectiveCard key={retro.id} retro={retro} />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-8 text-center">
                <p className="text-gray-700 dark:text-gray-300 mb-2">아직 회고가 없습니다</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  &quot;주간 회고 생성&quot; 버튼을 눌러 이번 주를 돌아보세요
                </p>
              </div>
            )}
          </section>

          {/* Insights */}
          {dashboard?.recent_insights && dashboard.recent_insights.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                인사이트
              </h2>
              <div className="space-y-3">
                {dashboard.recent_insights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
