"use client";

import { useRef, useState } from "react";

interface Props {
  onAddText: (title: string, content: string) => Promise<void>;
  onAddUrl: (title: string, url: string) => Promise<void>;
  onAddFile: (title: string, file: File) => Promise<void>;
  onClose: () => void;
}

export default function AddKnowledgeModal({ onAddText, onAddUrl, onAddFile, onClose }: Props) {
  const [mode, setMode] = useState<"text" | "url" | "file">("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode === "text") {
        if (!title.trim() || !content.trim()) return;
        await onAddText(title.trim(), content.trim());
      } else if (mode === "url") {
        if (!title.trim() || !url.trim()) return;
        await onAddUrl(title.trim(), url.trim());
      } else if (mode === "file") {
        if (!file) return;
        const docTitle = title.trim() || file.name.replace(/\.[^.]+$/, "");
        await onAddFile(docTitle, file);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const isDisabled = submitting || (
    mode === "text" ? (!title.trim() || !content.trim()) :
    mode === "url" ? (!title.trim() || !url.trim()) :
    !file
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">지식 추가</h2>

        <div className="flex gap-2">
          {(["text", "url", "file"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                mode === m
                  ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 text-blue-600"
                  : "border-gray-200 dark:border-gray-700 text-gray-600"
              }`}
            >
              {m === "text" ? "텍스트" : m === "url" ? "URL" : "파일"}
            </button>
          ))}
        </div>

        {mode !== "file" && (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            autoFocus
          />
        )}

        {mode === "text" && (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="기억할 내용을 입력하세요..."
            rows={6}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 resize-none"
          />
        )}

        {mode === "url" && (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        )}

        {mode === "file" && (
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 (비우면 파일명 사용)"
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 mb-3"
            />
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full px-4 py-8 border-2 border-dashed rounded-xl text-center transition hover:border-blue-400 dark:border-gray-700 dark:hover:border-blue-500"
            >
              {file ? (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{file.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">PDF, DOCX, TXT 파일을 선택하세요</p>
                  <p className="text-xs text-gray-400 mt-1">최대 10MB</p>
                </div>
              )}
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isDisabled}
            className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
          >
            {submitting ? "추가 중..." : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}
