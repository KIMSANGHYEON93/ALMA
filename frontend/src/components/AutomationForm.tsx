"use client";

import { useState } from "react";
import type { AutomationRuleCreate } from "@/lib/types";

interface Props {
  onSubmit: (data: AutomationRuleCreate) => Promise<void>;
  onClose: () => void;
}

const TRIGGER_OPTIONS = [
  { value: "habit.checkin_completed", label: "습관 체크인 완료" },
  { value: "habit.created", label: "습관 생성" },
  { value: "goal.created", label: "목표 생성" },
  { value: "goal.status_changed", label: "목표 상태 변경" },
  { value: "chat.message_processed", label: "채팅 메시지 처리" },
];

const ACTION_OPTIONS = [
  { value: "notification", label: "알림 메시지" },
  { value: "log", label: "로그 기록" },
];

export default function AutomationForm({ onSubmit, onClose }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("habit.checkin_completed");
  const [actionType, setActionType] = useState("notification");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const actionConfig: Record<string, unknown> =
        actionType === "notification"
          ? { message: message || `${name} 실행됨` }
          : { log_message: message || `${name} 로그` };

      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        trigger_event: triggerEvent,
        action_type: actionType,
        action_config: actionConfig,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">새 자동화 규칙</h2>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="규칙 이름"
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          autoFocus
        />

        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="설명 (선택)"
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
        />

        <div>
          <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">트리거 이벤트</label>
          <select
            value={triggerEvent}
            onChange={(e) => setTriggerEvent(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          >
            {TRIGGER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">액션 타입</label>
          <div className="flex gap-2">
            {ACTION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setActionType(opt.value)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                  actionType === opt.value
                    ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 text-blue-600"
                    : "border-gray-200 dark:border-gray-700 text-gray-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={actionType === "notification" ? "알림 메시지" : "로그 메시지"}
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
        />

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || submitting}
            className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
          >
            {submitting ? "생성 중..." : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}
