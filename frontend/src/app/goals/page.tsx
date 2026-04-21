"use client";

import { useState } from "react";
import NavBar from "@/components/common/NavBar";
import Spinner from "@/components/common/Spinner";
import GoalCard from "@/components/GoalCard";
import GoalDetailView from "@/components/GoalDetail";
import CreateGoalModal from "@/components/CreateGoalModal";
import { useAuth } from "@/contexts/AuthContext";
import { useGoals, useGoalDetail } from "@/hooks/useGoals";

export default function GoalsPage() {
  const { isLoading: authLoading } = useAuth();
  const { goals, summary, loading, error, createGoal, deleteGoal, updateGoalStatus, refresh } =
    useGoals();
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const { detail, addMilestone, completeMilestone, deleteMilestone, refresh: refreshDetail } =
    useGoalDetail(selectedGoalId);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="md" label="목표 로드 중" />
      </div>
    );
  }

  const filteredGoals = filter === "all" ? goals : goals.filter((g) => g.status === filter);

  const handleStatusChange = async (status: string) => {
    if (!selectedGoalId) return;
    await updateGoalStatus(selectedGoalId, status);
    await refreshDetail();
    await refresh();
  };

  const handleDelete = async () => {
    if (!selectedGoalId) return;
    await deleteGoal(selectedGoalId);
    setSelectedGoalId(null);
  };

  return (
    <div className="flex flex-col h-screen">
      <NavBar />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 border-r dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900">
          {/* Summary */}
          {summary && (
            <div className="p-4 border-b dark:border-gray-800">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {summary.active_goals}
                  </p>
                  <p className="text-xs text-gray-500">진행 중</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-600">
                    {summary.total_goals - summary.active_goals}
                  </p>
                  <p className="text-xs text-gray-500">완료</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-sky-600">
                    {summary.average_progress}%
                  </p>
                  <p className="text-xs text-gray-500">평균</p>
                </div>
              </div>
            </div>
          )}

          {/* Filter + Create */}
          <div className="p-3 border-b dark:border-gray-800 space-y-2">
            <button
              onClick={() => setShowCreate(true)}
              className="w-full py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition text-sm"
            >
              + 새 목표
            </button>
            <div className="flex gap-1">
              {[
                { key: "all", label: "전체" },
                { key: "active", label: "진행 중" },
                { key: "completed", label: "완료" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`flex-1 py-1 text-xs rounded-md transition ${
                    filter === f.key
                      ? "bg-sky-100 dark:bg-sky-900/30 text-sky-600"
                      : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="mx-3 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
            >
              <p className="text-xs text-red-700 dark:text-red-400 mb-2">{error}</p>
              <button
                onClick={refresh}
                className="text-xs font-medium text-red-700 dark:text-red-300 hover:underline"
              >
                다시 시도
              </button>
            </div>
          )}

          {/* Goal list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredGoals.length === 0 ? (
              <div className="text-center mt-8 px-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  {filter === "all" ? "아직 목표가 없습니다" : "해당하는 목표가 없습니다"}
                </p>
                {filter === "all" && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    + 첫 목표 만들기
                  </button>
                )}
              </div>
            ) : (
              filteredGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  isActive={selectedGoalId === goal.id}
                  onSelect={setSelectedGoalId}
                />
              ))
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
          {detail ? (
            <GoalDetailView
              detail={detail}
              onAddMilestone={addMilestone}
              onCompleteMilestone={completeMilestone}
              onDeleteMilestone={deleteMilestone}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <p className="text-lg mb-2">목표를 선택하거나 새로 만드세요</p>
                <p className="text-sm">성장의 여정을 함께 시작합니다</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateGoalModal
          onClose={() => setShowCreate(false)}
          onCreate={async (data) => {
            const goal = await createGoal(data);
            if (goal) setSelectedGoalId(goal.id);
          }}
        />
      )}
    </div>
  );
}
