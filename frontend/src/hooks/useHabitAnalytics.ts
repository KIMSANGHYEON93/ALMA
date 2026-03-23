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

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const year = new Date().getFullYear();
      const [h, t, c, cor] = await Promise.all([
        apiClient<HeatmapData>(`/api/habits/analytics/heatmap?year=${year}`, { token }),
        apiClient<TrendData>(`/api/habits/analytics/trends?days=${days}`, { token }),
        apiClient<CompletionData>(`/api/habits/analytics/completion?days=${days}`, { token }),
        apiClient<CorrelationData>(`/api/habits/analytics/correlations?days=${days}`, { token }),
      ]);
      setHeatmap(h);
      setTrends(t);
      setCompletion(c);
      setCorrelations(cor);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [token, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const generateInsight = useCallback(async () => {
    if (!token) return;
    setInsightLoading(true);
    try {
      const result = await apiClient<InsightResult>("/api/habits/analytics/insight", {
        method: "POST",
        token,
      });
      setInsight(result);
    } catch {
      // handled
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
    generateInsight,
    refresh: fetchData,
  };
}
