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

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [dash, retros] = await Promise.all([
        apiClient<InsightDashboard>("/api/insights/dashboard", { token }),
        apiClient<Retrospective[]>("/api/insights/retrospectives", { token }),
      ]);
      setDashboard(dash);
      setRetrospectives(retros);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const generateRetrospective = async () => {
    if (!token || generating) return;
    setGenerating(true);
    try {
      await apiClient<Retrospective>("/api/insights/retrospectives", {
        method: "POST",
        token,
        body: {},
      });
      await fetchData();
    } finally {
      setGenerating(false);
    }
  };

  return { dashboard, retrospectives, loading, generating, generateRetrospective, refresh: fetchData };
}
