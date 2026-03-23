"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { AutomationRule, AutomationRuleCreate } from "@/lib/types";

export function useAutomations() {
  const { token } = useAuth();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiClient<AutomationRule[]>("/api/automations?active_only=false", { token });
      setRules(data);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRules();
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

  return { rules, loading, createRule, deleteRule, toggleRule, refresh: fetchRules };
}
