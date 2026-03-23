"use client";

import { useState } from "react";
import Link from "next/link";
import NavBar from "@/components/common/NavBar";
import HabitCard from "@/components/HabitCard";
import HabitForm from "@/components/HabitForm";
import HabitTodaySummary from "@/components/HabitTodaySummary";
import { useAuth } from "@/contexts/AuthContext";
import { useHabits } from "@/hooks/useHabits";
import type { HabitCreate } from "@/lib/types";

export default function HabitsPage() {
  const { isLoading: authLoading } = useAuth();
  const { habits, todaySummary, loading, createHabit, updateHabit, deleteHabit, checkin } = useHabits();
  const [showCreate, setShowCreate] = useState(false);
  const [editingHabit, setEditingHabit] = useState<string | null>(null);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-400">로딩 중...</span>
      </div>
    );
  }

  // 로컬 timezone 기준 날짜 (UTC의 toISOString은 한국시간 00:00~09:00에 전날이 됨)
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayMap = new Map(todaySummary?.habits.map((h) => [h.id, h]));

  // Sort: scheduled today first, then by sort_order
  const sortedHabits = [...habits].sort((a, b) => {
    const aScheduled = todayMap.get(a.id)?.scheduled_today ? 0 : 1;
    const bScheduled = todayMap.get(b.id)?.scheduled_today ? 0 : 1;
    if (aScheduled !== bScheduled) return aScheduled - bScheduled;
    return a.sort_order - b.sort_order;
  });

  return (
    <div className="flex flex-col h-screen">
      <NavBar />
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
        <div className="max-w-2xl mx-auto">
          <HabitTodaySummary summary={todaySummary} />
          <div className="px-4 pt-2">
            <Link href="/habits/analytics" className="text-sm text-blue-500 hover:text-blue-600">
              통계 보기 →
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {sortedHabits.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg mb-2">아직 습관이 없습니다</p>
                <p className="text-sm">+ 버튼을 눌러 첫 습관을 추가해보세요</p>
              </div>
            ) : (
              sortedHabits.map((habit) => {
                const todayItem = todayMap.get(habit.id);
                const item = todayItem || {
                  id: habit.id,
                  title: habit.title,
                  frequency_type: habit.frequency_type,
                  scheduled_today: false,
                  checked_in: false,
                  completed: false,
                  value: null,
                  target_value: habit.target_value,
                  target_unit: habit.target_unit,
                  streak: 0,
                  note: null,
                };
                return (
                  <HabitCard
                    key={habit.id}
                    item={item}
                    onCheckin={async (completed, value, note) => {
                      await checkin(habit.id, today, completed, value, note);
                    }}
                    onEdit={() => setEditingHabit(habit.id)}
                    onPause={() => updateHabit(habit.id, { status: "paused" })}
                    onDelete={() => {
                      if (confirm("이 습관을 삭제하시겠습니까?")) {
                        deleteHabit(habit.id);
                      }
                    }}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* FAB */}
        <button
          onClick={() => setShowCreate(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-500 text-white rounded-full shadow-lg hover:bg-emerald-600 transition flex items-center justify-center text-2xl"
        >
          +
        </button>

        {showCreate && (
          <HabitForm
            onSubmit={createHabit}
            onClose={() => setShowCreate(false)}
          />
        )}

        {editingHabit && (() => {
          const h = habits.find((x) => x.id === editingHabit);
          return h ? (
            <HabitForm
              initial={{
                title: h.title,
                description: h.description || undefined,
                frequency_type: h.frequency_type,
                frequency_value: h.frequency_value,
                target_value: h.target_value || undefined,
                target_unit: h.target_unit || undefined,
              }}
              onSubmit={async (data) => {
                await updateHabit(editingHabit, data as unknown as Record<string, unknown>);
              }}
              onClose={() => setEditingHabit(null)}
            />
          ) : null;
        })()}
      </div>
    </div>
  );
}
