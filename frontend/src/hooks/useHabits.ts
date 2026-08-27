"use client";

import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { errMessage, swrDefaults } from "@/lib/swr";
import { useAuth } from "@/contexts/AuthContext";
import type { Habit, HabitCreate, HabitLog, TodaySummary } from "@/lib/types";

/** 목록과 오늘 요약을 함께 쓰는 화면이라 한 키로 묶는다. */
type HabitsBundle = { habits: Habit[]; todaySummary: TodaySummary | null };

export function useHabits() {
  const { token } = useAuth();

  const key = token ? (["habits-bundle", token] as const) : null;
  const { data, isLoading, error, mutate } = useSWR<HabitsBundle>(
    key,
    async ([, t]: readonly [string, string]): Promise<HabitsBundle> => {
      const [habits, todaySummary] = await Promise.all([
        apiClient<Habit[]>("/api/habits?status=active", { token: t }),
        apiClient<TodaySummary>("/api/habits/today", { token: t }),
      ]);
      return { habits, todaySummary };
    },
    swrDefaults
  );

  const createHabit = async (payload: HabitCreate) => {
    if (!token) return;
    await apiClient<Habit>("/api/habits", {
      method: "POST",
      token,
      body: payload,
    });
    await mutate();
  };

  const updateHabit = async (id: string, payload: Record<string, unknown>) => {
    if (!token) return;
    await apiClient<Habit>(`/api/habits/${id}`, {
      method: "PUT",
      token,
      body: payload,
    });
    await mutate();
  };

  const deleteHabit = async (id: string) => {
    if (!token) return;
    await apiClient(`/api/habits/${id}`, { method: "DELETE", token });
    await mutate();
  };

  const checkin = async (
    habitId: string,
    logDate: string,
    completed: boolean,
    value?: number,
    note?: string
  ) => {
    if (!token) return;
    await apiClient<HabitLog>(`/api/habits/${habitId}/checkin`, {
      method: "POST",
      token,
      body: { log_date: logDate, completed, value, note },
    });
    await mutate();
  };

  return {
    habits: data?.habits ?? [],
    todaySummary: data?.todaySummary ?? null,
    loading: isLoading,
    error: errMessage(error, "습관 조회 실패"),
    createHabit,
    updateHabit,
    deleteHabit,
    checkin,
    refresh: () => mutate(),
  };
}
