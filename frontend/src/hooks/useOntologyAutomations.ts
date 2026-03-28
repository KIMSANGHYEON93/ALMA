"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import type { OntologyAutomation, OntologyAutomationLog } from "@/lib/types";

export function useOntologyAutomations() {
  const { token } = useAuth();
  const [automations, setAutomations] = useState<OntologyAutomation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAutomations = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await apiClient<OntologyAutomation[]>(
        "/api/ontology/automations",
        { token }
      );
      setAutomations(data);
    } catch {
      // 401 handled by apiClient
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAutomations(); }, [fetchAutomations]);
  return { automations, loading, refresh: fetchAutomations };
}

export function useAutomationLogs() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<OntologyAutomationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await apiClient<OntologyAutomationLog[]>(
        "/api/ontology/automations/logs",
        { token }
      );
      setLogs(data);
    } catch {
      // 401 handled by apiClient
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  return { logs, loading, refresh: fetchLogs };
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
  return apiClient<{ executed: number; results: unknown[] }>(
    `/api/ontology/automations/execute`,
    {
      method: "POST",
      token,
      body: { insight_id: insightId },
    }
  );
}
