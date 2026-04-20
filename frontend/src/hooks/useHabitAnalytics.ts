"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type {
  HeatmapData,
  TrendData,
  CompletionData,
  CorrelationData,
  InsightResult,
} from "@/lib/types";

export function useHabitAnalytics(days: number = 30) {
  const { token } = useAuth();
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [completion, setCompletion] = useState<CompletionData | null>(null);
  const [correlations, setCorrelations] = useState<CorrelationData | null>(null);
  const [insight, setInsight] = useState<InsightResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insightError, setInsightError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const year = new Date().getFullYear();
        const [h, t, c, cor] = await Promise.all([
          apiClient<HeatmapData>(`/api/habits/analytics/heatmap?year=${year}`, { token, signal }),
          apiClient<TrendData>(`/api/habits/analytics/trends?days=${days}`, { token, signal }),
          apiClient<CompletionData>(`/api/habits/analytics/completion?days=${days}`, { token, signal }),
          apiClient<CorrelationData>(`/api/habits/analytics/correlations?days=${days}`, { token, signal }),
        ]);
        setHeatmap(h);
        setTrends(t);
        setCompletion(c);
        setCorrelations(cor);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "분석 데이터 조회 실패");
      } finally {
        setLoading(false);
      }
    },
    [token, days]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchData(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchData]);

  const generateInsight = useCallback(async () => {
    if (!token) return;
    setInsightLoading(true);
    setInsightError(null);
    try {
      const result = await apiClient<InsightResult>("/api/habits/analytics/insight", {
        method: "POST",
        token,
      });
      setInsight(result);
    } catch (err) {
      setInsightError(err instanceof Error ? err.message : "인사이트 생성 실패");
    } finally {
      setInsightLoading(false);
    }
  }, [token]);

  return {
    heatmap,
    trends,
    completion,
    correlations,
    insight,
    loading,
    insightLoading,
    error,
    insightError,
    generateInsight,
    refresh: () => fetchData(),
  };
}
