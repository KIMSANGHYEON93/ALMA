"use client";

import { useState } from "react";
import Modal from "./common/Modal";

interface CreateGoalModalProps {
  onClose: () => void;
  onCreate: (data: { title: string; description?: string; category: string; target_date?: string }) => Promise<void>;
}

const categories = [
  { value: "personal", label: "개인" },
  { value: "career", label: "커리어" },
  { value: "health", label: "건강" },
  { value: "learning", label: "학습" },
  { value: "finance", label: "재정" },
  { value: "other", label: "기타" },
];

export default function CreateGoalModal({ onClose, onCreate }: CreateGoalModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("personal");
  const [targetDate, setTargetDate] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isCreating) return;
    setError(null);
    setIsCreating(true);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        target_date: targetDate || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "목표 생성에 실패했습니다");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal open onClose={onClose} ariaLabel="새 목표 만들기" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          새 목표 만들기
        </h2>

        <div>
          <label htmlFor="goal-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            목표
          </label>
          <input
            id="goal-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="달성하고 싶은 목표를 입력하세요"
            required
            autoFocus
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div>
          <label htmlFor="goal-desc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            설명 (선택)
          </label>
          <textarea
            id="goal-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="목표에 대한 설명..."
            rows={2}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
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
                    ? "border-sky-500 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="goal-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            목표일 (선택)
          </label>
          <input
            id="goal-date"
            type="date"
            value={targetDate}
            min={todayIso}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg"
          >
            {error}
          </p>
        )}

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
            disabled={!title.trim() || isCreating}
            className="flex-1 py-2 text-sm bg-sky-700 text-white rounded-lg hover:bg-sky-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isCreating ? "생성 중..." : "만들기"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
