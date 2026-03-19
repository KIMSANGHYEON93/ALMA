"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { GoalCategory } from "@/lib/types";

interface AddGoalFromChatModalProps {
  messageContent: string;
  onClose: () => void;
  onSuccess: () => void;
}

const categories: { value: GoalCategory; label: string }[] = [
  { value: "personal", label: "개인" },
  { value: "career", label: "커리어" },
  { value: "health", label: "건강" },
  { value: "learning", label: "학습" },
  { value: "finance", label: "재정" },
  { value: "other", label: "기타" },
];

function extractTitle(content: string): string {
  // 첫 줄 또는 첫 50자를 제목 후보로 사용
  const firstLine = content.split("\n").find((l) => l.trim().length > 0) || "";
  const cleaned = firstLine.replace(/^[#*\->\s]+/, "").trim();
  return cleaned.slice(0, 50);
}

export default function AddGoalFromChatModal({
  messageContent,
  onClose,
  onSuccess,
}: AddGoalFromChatModalProps) {
  const { token } = useAuth();
  const [title, setTitle] = useState(extractTitle(messageContent));
  const [description, setDescription] = useState(messageContent.slice(0, 500));
  const [category, setCategory] = useState<GoalCategory>("personal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !token || saving) return;
    setSaving(true);
    setError("");
    try {
      await apiClient("/api/goals", {
        method: "POST",
        token,
        body: {
          title: title.trim(),
          description: description.trim() || undefined,
          category,
        },
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "목표 생성 실패");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 space-y-4 mx-4"
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          대화에서 목표 추가
        </h2>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <div>
          <label htmlFor="goal-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            목표 제목
          </label>
          <input
            id="goal-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="goal-desc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            설명 (AI 응답에서 발췌)
          </label>
          <textarea
            id="goal-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            카테고리
          </label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                  category === cat.value
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-sm border rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="flex-1 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {saving ? "추가 중..." : "목표 추가"}
          </button>
        </div>
      </form>
    </div>
  );
}
