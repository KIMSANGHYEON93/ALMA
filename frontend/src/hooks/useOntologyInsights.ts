"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import type { OntologyInsight, InsightSummary } from "@/lib/types";

export function useOntologyInsights(params?: { type?: string; status?: string }) {
  const { token } = useAuth();
  const [insights, setInsights] = useState<OntologyInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const searchParams = new URLSearchParams();
      if (params?.type) searchParams.set("type", params.type);
      if (params?.status) searchParams.set("status", params.status);
      const qs = searchParams.toString();
      const url = `/api/ontology/insights${qs ? "?" + qs : ""}`;
      const data = await apiClient<OntologyInsight[]>(url, { token });
      setInsights(data);
    } catch {
      // 401 handled by apiClient
    } finally {
      setLoading(false);
    }
  }, [token, params?.type, params?.status]);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);
  return { insights, loading, refresh: fetchInsights };
}

export function useInsightSummary() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<InsightSummary | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiClient<InsightSummary>("/api/ontology/insights/summary", { token });
      setSummary(data);
    } catch {
      // 401 handled by apiClient
    }
  }, [token]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  return { summary, refresh: fetchSummary };
}

export async function generateInsights(token: string) {
  return apiClient<{ insights_count: number; analysis: Record<string, unknown> }>(
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
