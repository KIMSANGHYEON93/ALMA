"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import NavBar from "@/components/common/NavBar";
import Spinner from "@/components/common/Spinner";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import HabitCard from "@/components/HabitCard";
import HabitForm from "@/components/HabitForm";
import HabitTodaySummary from "@/components/HabitTodaySummary";
import { useAuth } from "@/contexts/AuthContext";
import { useHabits } from "@/hooks/useHabits";

export default function HabitsPage() {
  const { isLoading: authLoading } = useAuth();
  const { habits, todaySummary, loading, error, createHabit, updateHabit, deleteHabit, checkin, refresh } =
    useHabits();
  const [showCreate, setShowCreate] = useState(false);
  const [editingHabit, setEditingHabit] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 로컬 timezone 기준 날짜 (UTC의 toISOString은 한국시간 00:00~09:00에 전날이 됨)
  // useMemo로 마운트 시 1회만 계산하여 handleCheckin deps 안정화 (자정 경계 엣지 허용 — 페이지 새로고침 시 갱신)
  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const handleCheckin = useCallback(
    async (habitId: string, completed: boolean, value?: number, note?: string) => {
      await checkin(habitId, today, completed, value, note);
    },
    [checkin, today]
  );

  const handleEdit = useCallback((habitId: string) => setEditingHabit(habitId), []);
  const handlePause = useCallback((habitId: string) => updateHabit(habitId, { status: "paused" }), [updateHabit]);
  const handleDelete = useCallback((habitId: string) => setConfirmDeleteId(habitId), []);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="md" label="습관 로드 중" />
      </div>
    );
  }
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
            <Link href="/habits/analytics" className="text-sm text-sky-700 hover:text-sky-800">
              통계 보기 →
            </Link>
          </div>
          {error && (
            <div
              role="alert"
              className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start justify-between gap-2"
            >
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              <button
                onClick={refresh}
                className="text-xs font-medium text-red-700 dark:text-red-300 hover:underline shrink-0"
              >
                다시 시도
              </button>
            </div>
          )}
          <div className="p-4 space-y-3">
            {sortedHabits.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg mb-2 text-gray-700 dark:text-gray-300">
                  아직 습관이 없습니다
                </p>
                <p className="text-sm mb-4 text-gray-500 dark:text-gray-400">
                  매일 실천할 작은 습관부터 시작해보세요
                </p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 text-sm font-medium"
                >
                  + 첫 습관 만들기
                </button>
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
                    onCheckin={handleCheckin}
                    onEdit={handleEdit}
                    onPause={handlePause}
                    onDelete={handleDelete}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* FAB */}
        <button
          onClick={() => setShowCreate(true)}
          aria-label="습관 추가"
          className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-700 text-white rounded-full shadow-lg hover:bg-emerald-800 transition flex items-center justify-center text-2xl"
        >
          +
        </button>

        <ConfirmDialog
          open={confirmDeleteId !== null}
          title="습관 삭제"
          message="이 습관을 삭제하시겠습니까? 기록된 체크인은 유지되지만 목록에서 사라집니다."
          confirmLabel="삭제"
          cancelLabel="취소"
          variant="danger"
          onConfirm={() => {
            if (confirmDeleteId) deleteHabit(confirmDeleteId);
            setConfirmDeleteId(null);
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />

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
