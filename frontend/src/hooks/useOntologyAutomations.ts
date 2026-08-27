"use client";

import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { authFetcher, errMessage, swrDefaults, type AuthKey } from "@/lib/swr";
import type { OntologyAutomation, OntologyAutomationLog } from "@/lib/types";

const LIST_URL = "/api/ontology/automations";
const LOGS_URL = "/api/ontology/automations/logs";

export function useOntologyAutomations() {
  const { token } = useAuth();
  const key: AuthKey | null = token ? [LIST_URL, token] : null;
  const { data, isLoading, error, mutate } = useSWR<OntologyAutomation[]>(
    key,
    authFetcher,
    swrDefaults
  );

  return {
    automations: data ?? [],
    loading: isLoading,
    error: errMessage(error, "자동화 조회 실패"),
    refresh: () => mutate(),
  };
}

export function useAutomationLogs() {
  const { token } = useAuth();
  const key: AuthKey | null = token ? [LOGS_URL, token] : null;
  const { data, isLoading, error, mutate } = useSWR<OntologyAutomationLog[]>(
    key,
    authFetcher,
    swrDefaults
  );

  return {
    logs: data ?? [],
    loading: isLoading,
    error: errMessage(error, "로그 조회 실패"),
    refresh: () => mutate(),
  };
}

export async function createAutomation(
  data: {
    name: string;
    insight_type: string;
    action_type: string;
    auto_execute?: boolean;
  },
  token: string
) {
  return apiClient<OntologyAutomation>(LIST_URL, {
    method: "POST",
    token,
    body: data,
  });
}

export async function toggleAutomation(
  id: string,
  enabled: boolean,
  token: string
) {
  return apiClient<OntologyAutomation>(`${LIST_URL}/${id}`, {
    method: "PATCH",
    token,
    body: { enabled },
  });
}

export async function deleteAutomation(id: string, token: string) {
  return apiClient<void>(`${LIST_URL}/${id}`, { method: "DELETE", token });
}

export async function executeAutomation(insightId: string, token: string) {
  return apiClient<{ results: Record<string, unknown>[] }>(
    `${LIST_URL}/execute`,
    {
      method: "POST",
      token,
      body: { insight_id: insightId },
    }
  );
}
