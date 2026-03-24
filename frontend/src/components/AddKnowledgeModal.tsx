"use client";

import { useState } from "react";

interface Props {
  onAddText: (title: string, content: string) => Promise<void>;
  onAddUrl: (title: string, url: string) => Promise<void>;
  onClose: () => void;
}

export default function AddKnowledgeModal({ onAddText, onAddUrl, onClose }: Props) {
  const [mode, setMode] = useState<"text" | "url">("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      if (mode === "text") {
        if (!content.trim()) return;
        await onAddText(title.trim(), content.trim());
      } else {
        if (!url.trim()) return;
        await onAddUrl(title.trim(), url.trim());
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">지식 추가</h2>

        <div className="flex gap-2">
          <button
            onClick={() => setMode("text")}
            className={`px-3 py-1.5 text-sm rounded-lg border transition ${
              mode === "text"
                ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 text-blue-600"
                : "border-gray-200 dark:border-gray-700 text-gray-600"
            }`}
          >
            텍스트
          </button>
          <button
            onClick={() => setMode("url")}
            className={`px-3 py-1.5 text-sm rounded-lg border transition ${
              mode === "url"
                ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 text-blue-600"
                : "border-gray-200 dark:border-gray-700 text-gray-600"
            }`}
          >
            URL
          </button>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          autoFocus
        />

        {mode === "text" ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="기억할 내용을 입력하세요..."
            rows={6}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 resize-none"
          />
        ) : (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || submitting || (mode === "text" ? !content.trim() : !url.trim())}
            className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
          >
            {submitting ? "추가 중..." : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}
