"use client";

import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { authFetcher, errMessage, swrDefaults, type AuthKey } from "@/lib/swr";
import { useAuth } from "@/contexts/AuthContext";
import type { AutomationRule, AutomationRuleCreate } from "@/lib/types";

const LIST_URL = "/api/automations?active_only=false";

export function useAutomations() {
  const { token } = useAuth();
  const key: AuthKey | null = token ? [LIST_URL, token] : null;
  const { data, isLoading, error, mutate } = useSWR<AutomationRule[]>(
    key,
    authFetcher,
    swrDefaults
  );

  const createRule = async (payload: AutomationRuleCreate) => {
    if (!token) return;
    await apiClient<AutomationRule>("/api/automations", {
      method: "POST",
      token,
      body: payload,
    });
    await mutate();
  };

  const deleteRule = async (id: string) => {
    if (!token) return;
    await apiClient(`/api/automations/${id}`, { method: "DELETE", token });
    await mutate();
  };

  const toggleRule = async (id: string, isActive: boolean) => {
    if (!token) return;
    await apiClient<AutomationRule>(
      `/api/automations/${id}/toggle?is_active=${isActive}`,
      { method: "PUT", token }
    );
    await mutate();
  };

  return {
    rules: data ?? [],
    loading: isLoading,
    error: errMessage(error, "자동화 조회 실패"),
    createRule,
    deleteRule,
    toggleRule,
    refresh: () => mutate(),
  };
}
