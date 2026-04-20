"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import type { OntologyAutomation, OntologyAutomationLog } from "@/lib/types";

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || /aborted/i.test(err.message));
}

export function useOntologyAutomations() {
  const { token } = useAuth();
  const [automations, setAutomations] = useState<OntologyAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAutomations = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      setError(null);
      try {
        setLoading(true);
        const data = await apiClient<OntologyAutomation[]>(
          "/api/ontology/automations",
          { token, signal }
        );
        setAutomations(data);
      } catch (err) {
        if (!isAbortError(err)) {
          setError(err instanceof Error ? err.message : "자동화 조회 실패");
        }
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchAutomations(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchAutomations]);

  return { automations, loading, error, refresh: () => fetchAutomations() };
}

export function useAutomationLogs() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<OntologyAutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      setError(null);
      try {
        setLoading(true);
        const data = await apiClient<OntologyAutomationLog[]>(
          "/api/ontology/automations/logs",
          { token, signal }
        );
        setLogs(data);
      } catch (err) {
        if (!isAbortError(err)) {
          setError(err instanceof Error ? err.message : "로그 조회 실패");
        }
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchLogs(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchLogs]);

  return { logs, loading, error, refresh: () => fetchLogs() };
}

export async function createAutomation(
  data: { name: string; insight_type: string; action_type: string; auto_execute?: boolean },
  token: string
) {
  return apiClient<OntologyAutomation>("/api/ontology/automations", {
    method: "POST",
    token,
    body: data,
  });
}

export async function toggleAutomation(id: string, enabled: boolean, token: string) {
  return apiClient<OntologyAutomation>(`/api/ontology/automations/${id}`, {
    method: "PATCH",
    token,
    body: { enabled },
  });
}

export async function deleteAutomation(id: string, token: string) {
  return apiClient<void>(`/api/ontology/automations/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function executeAutomation(insightId: string, token: string) {
  return apiClient<{ results: Record<string, unknown>[] }>(
    `/api/ontology/automations/execute`,
    {
      method: "POST",
      token,
      body: { insight_id: insightId },
    }
  );
}
