"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { errMessage, swrDefaults } from "@/lib/swr";
import { useAuth } from "@/contexts/AuthContext";
import type {
  HeatmapData,
  TrendData,
  CompletionData,
  CorrelationData,
  InsightResult,
} from "@/lib/types";

/** 분석 화면이 4개 지표를 한 번에 그리므로 한 키로 묶는다. */
type AnalyticsBundle = {
  heatmap: HeatmapData;
  trends: TrendData;
  completion: CompletionData;
  correlations: CorrelationData;
};

export function useHabitAnalytics(days: number = 30) {
  const { token } = useAuth();
  const [insight, setInsight] = useState<InsightResult | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  // days가 키에 포함되므로 기간을 바꾸면 새 캐시 엔트리로 다시 불러온다.
  const key = token ? (["habit-analytics", token, days] as const) : null;
  const { data, isLoading, error, mutate } = useSWR<AnalyticsBundle>(
    key,
    async ([, t, d]: readonly [string, string, number]): Promise<AnalyticsBundle> => {
      const year = new Date().getFullYear();
      const [heatmap, trends, completion, correlations] = await Promise.all([
        apiClient<HeatmapData>(`/api/habits/analytics/heatmap?year=${year}`, {
          token: t,
        }),
        apiClient<TrendData>(`/api/habits/analytics/trends?days=${d}`, {
          token: t,
        }),
        apiClient<CompletionData>(
          `/api/habits/analytics/completion?days=${d}`,
          { token: t }
        ),
        apiClient<CorrelationData>(
          `/api/habits/analytics/correlations?days=${d}`,
          { token: t }
        ),
      ]);
      return { heatmap, trends, completion, correlations };
    },
    swrDefaults
  );

  const generateInsight = async () => {
    if (!token) return;
    setInsightLoading(true);
    setInsightError(null);
    try {
      const result = await apiClient<InsightResult>(
        "/api/habits/analytics/insight",
        { method: "POST", token }
      );
      setInsight(result);
    } catch (err) {
      setInsightError(err instanceof Error ? err.message : "인사이트 생성 실패");
    } finally {
      setInsightLoading(false);
    }
  };

  return {
    heatmap: data?.heatmap ?? null,
    trends: data?.trends ?? null,
    completion: data?.completion ?? null,
    correlations: data?.correlations ?? null,
    insight,
    loading: isLoading,
    insightLoading,
    error: errMessage(error, "분석 데이터 조회 실패"),
    insightError,
    generateInsight,
    refresh: () => mutate(),
  };
}
