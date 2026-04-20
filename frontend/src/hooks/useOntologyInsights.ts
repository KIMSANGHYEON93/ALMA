"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import type { OntologyInsight, InsightSummary } from "@/lib/types";

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || /aborted/i.test(err.message));
}

export function useOntologyInsights(params?: { type?: string; status?: string }) {
  const { token } = useAuth();
  const [insights, setInsights] = useState<OntologyInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      setError(null);
      try {
        setLoading(true);
        const searchParams = new URLSearchParams();
        if (params?.type) searchParams.set("insight_type", params.type);
        if (params?.status) searchParams.set("status", params.status);
        const qs = searchParams.toString();
        const url = `/api/ontology/insights${qs ? "?" + qs : ""}`;
        const data = await apiClient<OntologyInsight[]>(url, { token, signal });
        setInsights(data);
      } catch (err) {
        if (!isAbortError(err)) {
          setError(err instanceof Error ? err.message : "인사이트 조회 실패");
        }
      } finally {
        setLoading(false);
      }
    },
    [token, params?.type, params?.status]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchInsights(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchInsights]);

  return { insights, loading, error, refresh: () => fetchInsights() };
}

export function useInsightSummary() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<InsightSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      setError(null);
      try {
        const data = await apiClient<InsightSummary>("/api/ontology/insights/summary", { token, signal });
        setSummary(data);
      } catch (err) {
        if (!isAbortError(err)) {
          setError(err instanceof Error ? err.message : "요약 조회 실패");
        }
      }
    },
    [token]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchSummary(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchSummary]);

  return { summary, error, refresh: () => fetchSummary() };
}

export async function generateInsights(token: string) {
  return apiClient<{ analysis: Record<string, unknown>; insights: OntologyInsight[]; llm_used: boolean }>(
    "/api/ontology/insights/generate",
    { method: "POST", token }
  );
}

export async function updateInsightStatus(id: string, status: string, token: string) {
  return apiClient<OntologyInsight>(
    `/api/ontology/insights/${id}`,
    { method: "PATCH", token, body: { status } }
  );
}
