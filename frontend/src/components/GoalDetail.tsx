"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { GoalDetail as GoalDetailType } from "@/hooks/useGoals";

interface GoalDetailProps {
  detail: GoalDetailType;
  onAddMilestone: (title: string) => Promise<void>;
  onCompleteMilestone: (id: string) => Promise<void>;
  onDeleteMilestone: (id: string) => Promise<void>;
  onStatusChange: (status: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

const statusActions: Record<string, { label: string; next: string; color: string }[]> = {
  active: [
    { label: "완료", next: "completed", color: "bg-emerald-600 hover:bg-emerald-700" },
    { label: "일시정지", next: "paused", color: "bg-yellow-600 hover:bg-yellow-700" },
  ],
  paused: [
    { label: "재개", next: "active", color: "bg-sky-600 hover:bg-sky-700" },
    { label: "포기", next: "abandoned", color: "bg-red-600 hover:bg-red-700" },
  ],
  completed: [],
  abandoned: [],
};

export default function GoalDetailView({
  detail,
  onAddMilestone,
  onCompleteMilestone,
  onDeleteMilestone,
  onStatusChange,
  onDelete,
}: GoalDetailProps) {
  const [newMilestone, setNewMilestone] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddMilestone = async () => {
    if (!newMilestone.trim() || isAdding) return;
    setIsAdding(true);
    try {
      await onAddMilestone(newMilestone.trim());
      setNewMilestone("");
    } finally {
      setIsAdding(false);
    }
  };

  const completed = detail.milestones.filter((m) => m.status === "completed").length;
  const total = detail.milestones.length;
  const actions = statusActions[detail.status] || [];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          {detail.title}
        </h2>
        {detail.description && (
          <div className="text-sm text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {detail.description}
            </ReactMarkdown>
          </div>
        )}

        {/* Progress */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                detail.progress === 100 ? "bg-emerald-500" : "bg-sky-500"
              }`}
              style={{ width: `${detail.progress}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {detail.progress}%
          </span>
        </div>

        {detail.suggest_complete && detail.status === "active" && (
          <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-sm text-emerald-700 dark:text-emerald-300">
            모든 마일스톤 완료! 목표를 완료 처리하시겠습니까?
          </div>
        )}

        {/* Status actions */}
        <div className="mt-4 flex gap-2 flex-wrap">
          {actions.map((action) => (
            <button
              key={action.next}
              onClick={() => onStatusChange(action.next)}
              className={`px-3 py-1.5 text-xs text-white rounded-lg transition ${action.color}`}
            >
              {action.label}
            </button>
          ))}
          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-xs text-red-600 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition"
          >
            삭제
          </button>
        </div>
      </div>

      {/* Milestones */}
      <div className="border-t dark:border-gray-800 pt-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          마일스톤 ({completed}/{total})
        </h3>

        <div className="space-y-2 mb-4">
          {detail.milestones.map((ms) => (
            <div
              key={ms.id}
              className="flex items-center gap-3 p-3 rounded-lg border dark:border-gray-800 group"
            >
              <button
                onClick={() =>
                  ms.status === "pending" && onCompleteMilestone(ms.id)
                }
                disabled={ms.status === "completed"}
                aria-label={`${ms.title} 완료 토글`}
                aria-pressed={ms.status === "completed"}
                className={`relative w-5 h-5 rounded-full border-2 flex items-center justify-center transition shrink-0 before:absolute before:inset-[-12px] before:content-[''] ${
                  ms.status === "completed"
                    ? "bg-emerald-500 border-emerald-500"
                    : "border-gray-300 dark:border-gray-600 hover:border-sky-500"
                }`}
              >
                {ms.status === "completed" && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span
                className={`flex-1 text-sm ${
                  ms.status === "completed"
                    ? "text-gray-400 dark:text-gray-500 line-through"
                    : "text-gray-800 dark:text-gray-200"
                }`}
              >
                {ms.title}
              </span>
              <button
                onClick={() => onDeleteMilestone(ms.id)}
                aria-label={`${ms.title} 마일스톤 삭제`}
                className="relative p-2 text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition before:absolute before:inset-[-6px] before:content-['']"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Add milestone */}
        {detail.status === "active" && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newMilestone}
              onChange={(e) => setNewMilestone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddMilestone()}
              placeholder="새 마일스톤 추가..."
              className="flex-1 px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              onClick={handleAddMilestone}
              disabled={!newMilestone.trim() || isAdding}
              className="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 transition"
            >
              추가
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
