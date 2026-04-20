"use client";

import { useRef, useState } from "react";
import Modal from "./common/Modal";

interface Props {
  onAddText: (title: string, content: string) => Promise<void>;
  onAddUrl: (title: string, url: string) => Promise<void>;
  onAddFile: (title: string, file: File) => Promise<void>;
  onClose: () => void;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export default function AddKnowledgeModal({ onAddText, onAddUrl, onAddFile, onClose }: Props) {
  const [mode, setMode] = useState<"text" | "url" | "file">("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (selected: File | null) => {
    setError(null);
    if (selected && selected.size > MAX_FILE_BYTES) {
      setError(`파일이 너무 큽니다 (${(selected.size / 1024 / 1024).toFixed(1)}MB / 최대 10MB)`);
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setError(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "추가에 실패했습니다");
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
    <Modal open onClose={onClose} ariaLabel="지식 추가" maxWidth="max-w-lg">
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">지식 추가</h2>

        <div className="flex gap-2">
          {(["text", "url", "file"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                mode === m
                  ? "bg-sky-50 dark:bg-sky-900/30 border-sky-300 text-sky-600"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
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
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          />
        )}

        {mode === "text" && (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="기억할 내용을 입력하세요..."
            rows={6}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 resize-none"
          />
        )}

        {mode === "url" && (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          />
        )}

        {mode === "file" && (
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 (비우면 파일명 사용)"
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 mb-3"
            />
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,.markdown"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full px-4 py-8 border-2 border-dashed rounded-xl text-center transition hover:border-sky-400 dark:border-gray-700 dark:hover:border-sky-500"
            >
              {file ? (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{file.name}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">PDF, DOCX, TXT, MD 파일을 선택하세요</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">최대 10MB</p>
                </div>
              )}
            </button>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isDisabled}
            className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "추가 중..." : "추가"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
