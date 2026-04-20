"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { onGoalsChanged } from "@/lib/events";
import { useAuth } from "@/contexts/AuthContext";
import type { Goal, GoalDetail, GoalSummary, Milestone } from "@/lib/types";

export type { Goal, GoalDetail, GoalSummary, Milestone };

export function useGoals() {
  const { token } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<GoalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      setError(null);
      try {
        const [goalsData, summaryData] = await Promise.all([
          apiClient<Goal[]>("/api/goals", { token, signal }),
          apiClient<GoalSummary>("/api/goals/summary", { token, signal }),
        ]);
        setGoals(goalsData);
        setSummary(summaryData);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "목표 조회 실패");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchGoals(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchGoals]);

  // 다른 페이지에서 목표 변경 시 자동 갱신
  useEffect(() => {
    return onGoalsChanged(() => fetchGoals());
  }, [fetchGoals]);

  const createGoal = async (data: {
    title: string;
    description?: string;
    category?: string;
  }) => {
    if (!token) return null;
    const goal = await apiClient<Goal>("/api/goals", {
      method: "POST",
      token,
      body: data,
    });
    await fetchGoals();
    return goal;
  };

  const deleteGoal = async (goalId: string) => {
    if (!token) return;
    await apiClient<void>(`/api/goals/${goalId}`, {
      method: "DELETE",
      token,
    });
    await fetchGoals();
  };

  const updateGoalStatus = async (goalId: string, status: string) => {
    if (!token) return;
    await apiClient<Goal>(`/api/goals/${goalId}/status`, {
      method: "PATCH",
      token,
      body: { status },
    });
    await fetchGoals();
  };

  return {
    goals,
    summary,
    loading,
    error,
    createGoal,
    deleteGoal,
    updateGoalStatus,
    refresh: () => fetchGoals(),
  };
}

export function useGoalDetail(goalId: string | null) {
  const { token } = useAuth();
  const [detail, setDetail] = useState<GoalDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!token || !goalId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    try {
      const data = await apiClient<GoalDetail>(`/api/goals/${goalId}`, { token });
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [token, goalId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const addMilestone = async (title: string) => {
    if (!token || !goalId) return;
    await apiClient<Milestone>(`/api/goals/${goalId}/milestones`, {
      method: "POST",
      token,
      body: { title },
    });
    await fetchDetail();
  };

  const completeMilestone = async (milestoneId: string) => {
    if (!token || !goalId) return;
    await apiClient<GoalDetail>(
      `/api/goals/${goalId}/milestones/${milestoneId}/complete`,
      { method: "PATCH", token }
    );
    await fetchDetail();
  };

  const deleteMilestone = async (milestoneId: string) => {
    if (!token || !goalId) return;
    await apiClient<void>(
      `/api/goals/${goalId}/milestones/${milestoneId}`,
      { method: "DELETE", token }
    );
    await fetchDetail();
  };

  return { detail, loading, addMilestone, completeMilestone, deleteMilestone, refresh: fetchDetail };
}
