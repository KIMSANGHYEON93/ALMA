"use client";

import type { KnowledgeDocument } from "@/lib/types";

interface Props {
  doc: KnowledgeDocument;
  onDelete: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  processing: { label: "처리 중", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  ready: { label: "완료", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  error: { label: "오류", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

export default function KnowledgeCard({ doc, onDelete }: Props) {
  const status = STATUS_LABELS[doc.status] || STATUS_LABELS.error;

  return (
    <div className="p-4 rounded-xl border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">{doc.title}</h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
              {status.label}
            </span>
            <span className="text-xs text-gray-400">
              {doc.source_type === "url" ? "URL" : "텍스트"} · {doc.chunk_count}개 청크
            </span>
            {doc.source_url && (
              <a
                href={doc.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline truncate max-w-[200px]"
              >
                {doc.source_url}
              </a>
            )}
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
