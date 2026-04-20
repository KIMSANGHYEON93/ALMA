"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { InsightDashboard, Retrospective } from "@/lib/types";

export function useInsights() {
  const { token } = useAuth();
  const [dashboard, setDashboard] = useState<InsightDashboard | null>(null);
  const [retrospectives, setRetrospectives] = useState<Retrospective[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      setError(null);
      try {
        const [dash, retros] = await Promise.all([
          apiClient<InsightDashboard>("/api/insights/dashboard", { token, signal }),
          apiClient<Retrospective[]>("/api/insights/retrospectives", { token, signal }),
        ]);
        setDashboard(dash);
        setRetrospectives(retros);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "인사이트 조회 실패");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchData(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchData]);

  const generateRetrospective = async () => {
    if (!token || generating) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      await apiClient<Retrospective>("/api/insights/retrospectives", {
        method: "POST",
        token,
        body: {},
      });
      await fetchData();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "회고 생성 실패");
    } finally {
      setGenerating(false);
    }
  };

  return {
    dashboard,
    retrospectives,
    loading,
    generating,
    error,
    generateError,
    generateRetrospective,
    refresh: () => fetchData(),
  };
}
