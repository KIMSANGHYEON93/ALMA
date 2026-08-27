"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { errMessage, swrDefaults } from "@/lib/swr";
import { useAuth } from "@/contexts/AuthContext";
import type { InsightDashboard, Retrospective } from "@/lib/types";

const RETRO_URL = "/api/insights/retrospectives";

/** 대시보드와 회고를 함께 쓰는 화면이라 한 키로 묶어 동시에 가져온다. */
type InsightsBundle = {
  dashboard: InsightDashboard | null;
  retrospectives: Retrospective[];
};

export function useInsights() {
  const { token } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const key = token ? (["insights-bundle", token] as const) : null;
  const { data, isLoading, error, mutate } = useSWR<InsightsBundle>(
    key,
    async ([, t]: readonly [string, string]): Promise<InsightsBundle> => {
      const [dashboard, retrospectives] = await Promise.all([
        apiClient<InsightDashboard>("/api/insights/dashboard", { token: t }),
        apiClient<Retrospective[]>(RETRO_URL, { token: t }),
      ]);
      return { dashboard, retrospectives };
    },
    swrDefaults
  );

  const generateRetrospective = async () => {
    if (!token || generating) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      await apiClient<Retrospective>(RETRO_URL, {
        method: "POST",
        token,
        body: {},
      });
      await mutate();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "회고 생성 실패");
    } finally {
      setGenerating(false);
    }
  };

  return {
    dashboard: data?.dashboard ?? null,
    retrospectives: data?.retrospectives ?? [],
    loading: isLoading,
    generating,
    error: errMessage(error, "인사이트 조회 실패"),
    generateError,
    generateRetrospective,
    refresh: () => mutate(),
  };
}
