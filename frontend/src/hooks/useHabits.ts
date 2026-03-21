"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Habit, HabitCreate, HabitLog, TodaySummary } from "@/lib/types";

export function useHabits() {
  const { token } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [habitsData, summary] = await Promise.all([
        apiClient<Habit[]>("/api/habits?status=active", { token }),
        apiClient<TodaySummary>("/api/habits/today", { token }),
      ]);
      setHabits(habitsData);
      setTodaySummary(summary);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createHabit = async (data: HabitCreate) => {
    if (!token) return;
    await apiClient<Habit>("/api/habits", {
      method: "POST",
      token,
      body: data,
    });
    await fetchData();
  };

  const updateHabit = async (id: string, data: Record<string, unknown>) => {
    if (!token) return;
    await apiClient<Habit>(`/api/habits/${id}`, {
      method: "PUT",
      token,
      body: data,
    });
    await fetchData();
  };

  const deleteHabit = async (id: string) => {
    if (!token) return;
    await apiClient(`/api/habits/${id}`, { method: "DELETE", token });
    await fetchData();
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
    await fetchData();
  };

  return {
    habits,
    todaySummary,
    loading,
    createHabit,
    updateHabit,
    deleteHabit,
    checkin,
    refresh: fetchData,
  };
}
