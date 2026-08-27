"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { onGoalsChanged } from "@/lib/events";
import { authFetcher, errMessage, swrDefaults, type AuthKey } from "@/lib/swr";
import { useAuth } from "@/contexts/AuthContext";
import type { Goal, GoalDetail, GoalSummary, Milestone } from "@/lib/types";

export type { Goal, GoalDetail, GoalSummary, Milestone };

/** 목록과 요약을 함께 쓰는 화면이라 한 키로 묶는다. */
type GoalsBundle = { goals: Goal[]; summary: GoalSummary | null };

export function useGoals() {
  const { token } = useAuth();

  const key = token ? (["goals-bundle", token] as const) : null;
  const { data, isLoading, error, mutate } = useSWR<GoalsBundle>(
    key,
    async ([, t]: readonly [string, string]): Promise<GoalsBundle> => {
      const [goals, summary] = await Promise.all([
        apiClient<Goal[]>("/api/goals", { token: t }),
        apiClient<GoalSummary>("/api/goals/summary", { token: t }),
      ]);
      return { goals, summary };
    },
    swrDefaults
  );

  // 다른 페이지에서 목표 변경 시 자동 갱신
  useEffect(() => onGoalsChanged(() => void mutate()), [mutate]);

  const createGoal = async (payload: {
    title: string;
    description?: string;
    category?: string;
  }) => {
    if (!token) return null;
    const goal = await apiClient<Goal>("/api/goals", {
      method: "POST",
      token,
      body: payload,
    });
    await mutate();
    return goal;
  };

  const deleteGoal = async (goalId: string) => {
    if (!token) return;
    await apiClient<void>(`/api/goals/${goalId}`, { method: "DELETE", token });
    await mutate();
  };

  const updateGoalStatus = async (goalId: string, status: string) => {
    if (!token) return;
    await apiClient<Goal>(`/api/goals/${goalId}/status`, {
      method: "PATCH",
      token,
      body: { status },
    });
    await mutate();
  };

  return {
    goals: data?.goals ?? [],
    summary: data?.summary ?? null,
    loading: isLoading,
    error: errMessage(error, "목표 조회 실패"),
    createGoal,
    deleteGoal,
    updateGoalStatus,
    refresh: () => mutate(),
  };
}

export function useGoalDetail(goalId: string | null) {
  const { token } = useAuth();

  const key: AuthKey | null =
    token && goalId ? [`/api/goals/${goalId}`, token] : null;
  const { data, isLoading, mutate } = useSWR<GoalDetail>(
    key,
    authFetcher,
    swrDefaults
  );

  const addMilestone = async (title: string) => {
    if (!token || !goalId) return;
    await apiClient<Milestone>(`/api/goals/${goalId}/milestones`, {
      method: "POST",
      token,
      body: { title },
    });
    await mutate();
  };

  const completeMilestone = async (milestoneId: string) => {
    if (!token || !goalId) return;
    await apiClient<GoalDetail>(
      `/api/goals/${goalId}/milestones/${milestoneId}/complete`,
      { method: "PATCH", token }
    );
    await mutate();
  };

  const deleteMilestone = async (milestoneId: string) => {
    if (!token || !goalId) return;
    await apiClient<void>(`/api/goals/${goalId}/milestones/${milestoneId}`, {
      method: "DELETE",
      token,
    });
    await mutate();
  };

  return {
    detail: data ?? null,
    loading: isLoading,
    addMilestone,
    completeMilestone,
    deleteMilestone,
    refresh: () => mutate(),
  };
}
