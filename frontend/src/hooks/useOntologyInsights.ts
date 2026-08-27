"use client";

import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { authFetcher, errMessage, swrDefaults, type AuthKey } from "@/lib/swr";
import type { OntologyInsight, InsightSummary } from "@/lib/types";

export function useOntologyInsights(params?: {
  type?: string;
  status?: string;
}) {
  const { token } = useAuth();
  const type = params?.type;
  const status = params?.status;

  const searchParams = new URLSearchParams();
  if (type) searchParams.set("insight_type", type);
  if (status) searchParams.set("status", status);
  const qs = searchParams.toString();
  const url = `/api/ontology/insights${qs ? "?" + qs : ""}`;

  const key: AuthKey | null = token ? [url, token] : null;
  const { data, isLoading, error, mutate } = useSWR<OntologyInsight[]>(
    key,
    authFetcher,
    swrDefaults
  );

  return {
    insights: data ?? [],
    loading: isLoading,
    error: errMessage(error, "인사이트 조회 실패"),
    refresh: () => mutate(),
  };
}

export function useInsightSummary() {
  const { token } = useAuth();
  const key: AuthKey | null = token
    ? ["/api/ontology/insights/summary", token]
    : null;
  const { data, error, mutate } = useSWR<InsightSummary>(
    key,
    authFetcher,
    swrDefaults
  );

  return {
    summary: data ?? null,
    error: errMessage(error, "요약 조회 실패"),
    refresh: () => mutate(),
  };
}

export async function generateInsights(token: string) {
  return apiClient<{
    analysis: Record<string, unknown>;
    insights: OntologyInsight[];
    llm_used: boolean;
  }>("/api/ontology/insights/generate", { method: "POST", token });
}

export async function updateInsightStatus(
  id: string,
  status: string,
  token: string
) {
  return apiClient<OntologyInsight>(`/api/ontology/insights/${id}`, {
    method: "PATCH",
    token,
    body: { status },
  });
}
