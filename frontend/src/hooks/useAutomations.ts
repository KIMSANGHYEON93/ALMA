"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { AutomationRule, AutomationRuleCreate } from "@/lib/types";

export function useAutomations() {
  const { token } = useAuth();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      setError(null);
      try {
        const data = await apiClient<AutomationRule[]>("/api/automations?active_only=false", {
          token,
          signal,
        });
        setRules(data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "자동화 조회 실패");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchRules(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchRules]);

  const createRule = async (data: AutomationRuleCreate) => {
    if (!token) return;
    await apiClient<AutomationRule>("/api/automations", {
      method: "POST",
      token,
      body: data,
    });
    await fetchRules();
  };

  const deleteRule = async (id: string) => {
    if (!token) return;
    await apiClient(`/api/automations/${id}`, { method: "DELETE", token });
    await fetchRules();
  };

  const toggleRule = async (id: string, isActive: boolean) => {
    if (!token) return;
    await apiClient<AutomationRule>(`/api/automations/${id}/toggle?is_active=${isActive}`, {
      method: "PUT",
      token,
    });
    await fetchRules();
  };

  return { rules, loading, error, createRule, deleteRule, toggleRule, refresh: () => fetchRules() };
}
