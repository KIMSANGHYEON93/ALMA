"use client";

import NavBar from "@/components/common/NavBar";
import RetrospectiveCard from "@/components/RetrospectiveCard";
import InsightCard from "@/components/InsightCard";
import { useAuth } from "@/contexts/AuthContext";
import { useInsights } from "@/hooks/useInsights";

export default function InsightsPage() {
  const { isLoading: authLoading } = useAuth();
  const { dashboard, retrospectives, loading, generating, generateRetrospective } =
    useInsights();

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-400">로딩 중...</span>
      </div>
    );
  }

  const stats = dashboard?.stats;

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
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {generating ? "분석 중..." : "주간 회고 생성"}
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">
                  {stats.active_goals}
                </p>
                <p className="text-xs text-gray-500 mt-1">진행 중 목표</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {stats.completed_goals}
                </p>
                <p className="text-xs text-gray-500 mt-1">완료 목표</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4 text-center">
                <p className="text-2xl font-bold text-orange-500">
                  {stats.streak_days}일
                </p>
                <p className="text-xs text-gray-500 mt-1">연속 활동</p>
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
                <p className="text-gray-400 mb-2">아직 회고가 없습니다</p>
                <p className="text-sm text-gray-400">
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
