"use client";

import type { AutomationRule } from "@/lib/types";

interface Props {
  rule: AutomationRule;
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
}

const EVENT_LABELS: Record<string, string> = {
  "habit.checkin_completed": "습관 체크인",
  "habit.created": "습관 생성",
  "habit.deleted": "습관 삭제",
  "goal.created": "목표 생성",
  "goal.status_changed": "목표 상태 변경",
  "chat.message_processed": "채팅 메시지",
  "integration.action_executed": "외부 액션",
};

const ACTION_LABELS: Record<string, string> = {
  notification: "알림",
  "habit.checkin": "습관 체크인",
  log: "로그",
};

export default function AutomationCard({ rule, onToggle, onDelete }: Props) {
  return (
    <div
      className={`p-4 rounded-xl border transition ${
        rule.is_active
          ? "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
          : "bg-gray-50 dark:bg-gray-950 border-gray-100 dark:border-gray-900 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">{rule.name}</h3>
          {rule.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{rule.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              트리거: {EVENT_LABELS[rule.trigger_event] || rule.trigger_event}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              액션: {ACTION_LABELS[rule.action_type] || rule.action_type}
            </span>
            {rule.execution_count > 0 && (
              <span className="text-xs text-gray-400">
                {rule.execution_count}회 실행
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onToggle(!rule.is_active)}
            className={`w-10 h-5 rounded-full transition relative ${
              rule.is_active ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-700"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                rule.is_active ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <button
            onClick={onDelete}
            className="text-gray-300 hover:text-red-500 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
