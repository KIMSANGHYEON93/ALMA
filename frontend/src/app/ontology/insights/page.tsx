"use client";

import { useState } from "react";
import Link from "next/link";
import NavBar from "@/components/common/NavBar";
import { useAuth } from "@/contexts/AuthContext";
import {
  useOntologyInsights,
  useInsightSummary,
  generateInsights,
  updateInsightStatus,
} from "@/hooks/useOntologyInsights";
import InsightCard from "@/components/ontology/InsightCard";

const TYPE_LABELS: Record<string, string> = {
  hub_node: "허브",
  isolated: "고립",
  strong_path: "경로",
  conflict: "상충",
  opportunity: "기회",
  trend: "추세",
};

export default function OntologyInsightsPage() {
  const { isLoading, token } = useAuth();
  const [filterType, setFilterType] = useState<string | undefined>(undefined);
  const { insights, loading: insightsLoading, refresh: refreshInsights } = useOntologyInsights({
    type: filterType,
  });
  const { summary, refresh: refreshSummary } = useInsightSummary();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-400">로딩 중...</span>
      </div>
    );
  }

  const handleGenerate = async () => {
    if (!token) return;
    setGenerating(true);
    setError(null);
    try {
      await generateInsights(token);
      await Promise.all([refreshInsights(), refreshSummary()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 실행에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    if (!token) return;
    try {
      await updateInsightStatus(id, status, token);
      await Promise.all([refreshInsights(), refreshSummary()]);
    } catch {
      // ignore
    }
  };

  const handleDismiss = async (id: string) => {
    if (!token) return;
    try {
      await updateInsightStatus(id, "dismissed", token);
      await Promise.all([refreshInsights(), refreshSummary()]);
    } catch {
      // ignore
    }
  };

  const sortedInsights = [...insights].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const byTypeEntries = summary ? Object.entries(summary.by_type) : [];

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-white">
      <NavBar />
      <div className="p-6 max-w-4xl mx-auto w-full">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/ontology"
              className="text-gray-400 hover:text-white transition text-sm"
            >
              ← Ontology
            </Link>
            <h1 className="text-2xl font-bold">Insights</h1>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:cursor-not-allowed text-sm font-medium transition flex items-center gap-2"
          >
            {generating ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                분석 중...
              </>
            ) : (
              "분석 실행"
            )}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-white">{summary.total}</p>
              <p className="text-xs text-gray-400 mt-1">전체 인사이트</p>
            </div>
            <div className="bg-gray-900 border border-orange-800 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-orange-400">{summary.new_count}</p>
              <p className="text-xs text-gray-400 mt-1">새 인사이트</p>
            </div>
            {byTypeEntries.slice(0, 2).map(([type, count]) => (
              <div key={type} className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-blue-400">{count}</p>
                <p className="text-xs text-gray-400 mt-1">{TYPE_LABELS[type] ?? type}</p>
              </div>
            ))}
          </div>
        )}

        {/* Type filter */}
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => setFilterType(undefined)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition ${
              filterType === undefined ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            전체
          </button>
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? undefined : type)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                filterType === type ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Insights list */}
        {insightsLoading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-gray-400">로딩 중...</span>
          </div>
        ) : sortedInsights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-gray-500 mb-2">인사이트가 없습니다.</p>
            <p className="text-gray-600 text-sm">위 &quot;분석 실행&quot; 버튼으로 온톨로지를 분석해보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sortedInsights.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onStatusChange={handleStatusChange}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
