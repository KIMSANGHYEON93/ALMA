"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { InsightResult } from "@/lib/types";

interface Props {
  insight: InsightResult | null;
  loading: boolean;
  onGenerate: () => void;
}

export default function HabitInsightCard({ insight, loading, onGenerate }: Props) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">AI 코칭 인사이트</h3>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? "분석 중..." : "AI 분석"}
        </button>
      </div>
      {insight ? (
        <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{insight.content}</ReactMarkdown>
          <p className="text-xs text-gray-400 mt-2">{insight.generated_at}</p>
        </div>
      ) : (
        <p className="text-sm text-gray-400">AI 분석 버튼을 눌러 습관 패턴을 분석해보세요</p>
      )}
    </div>
  );
}
