"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { GoalSummary } from "@/lib/types";
import Link from "next/link";

export default function ActiveGoalsBanner() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<GoalSummary | null>(null);

  useEffect(() => {
    if (!token) return;
    apiClient<GoalSummary>("/api/goals/summary", { token })
      .then(setSummary)
      .catch(() => {});
  }, [token]);

  if (!summary || summary.active_goals === 0) return null;

  return (
    <Link
      href="/goals"
      className="flex items-center gap-3 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border-b dark:border-gray-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition"
    >
      <span className="text-xs text-emerald-700 dark:text-emerald-300">
        진행 중인 목표 {summary.active_goals}개 · 평균 {summary.average_progress}%
      </span>
      <span className="flex-1" />
      <span className="text-xs text-emerald-500">목표 보기 →</span>
    </Link>
  );
}
