import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  onAddGoal?: (content: string) => void;
}

export default React.memo(function MessageBubble({
  role,
  content,
  isStreaming = false,
  onAddGoal,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API 실패 시 무시
    }
  };

  return (
    <div
      className={`group flex ${isUser ? "justify-end" : "justify-start"}`}
      aria-label={isUser ? "사용자 메시지" : "AI 응답"}
    >
      <div className="max-w-[85%] md:max-w-[70%] relative">
        <div
          className={`px-4 py-2 rounded-2xl ${
            isUser
              ? "bg-sky-700 text-white rounded-br-md whitespace-pre-wrap"
              : "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md"
          }`}
        >
          {isUser ? (
            content
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-2 prose-code:text-sm prose-pre:bg-gray-900 prose-pre:text-gray-100 dark:prose-pre:bg-gray-950">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
              {isStreaming && (
                <span
                  className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-gray-600 dark:bg-gray-300 animate-pulse"
                  aria-label="입력 중"
                />
              )}
            </div>
          )}
        </div>

        {/* hover 시 나타나는 개별 메시지 복사 버튼 */}
        <button
          onClick={handleCopy}
          aria-label="메시지 복사"
          title={copied ? "복사됨" : "복사"}
          className={`absolute -top-3 ${
            isUser ? "-left-12" : "-right-12"
          } opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity w-11 h-11 flex items-center justify-center rounded-md bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:text-sky-700 dark:hover:text-sky-400 shadow-sm border border-gray-200 dark:border-gray-600 text-sm`}
        >
          {copied ? "✓" : "⎘"}
        </button>

        {/* AI 응답에만 "목표로 추가" 버튼 표시 */}
        {!isUser && onAddGoal && (
          <div className="mt-1 flex justify-start">
            <button
              onClick={() => onAddGoal(content)}
              className="text-xs text-gray-400 hover:text-emerald-500 transition flex items-center gap-1 px-1 py-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" strokeWidth={1.5} /><circle cx="12" cy="12" r="6" strokeWidth={1.5} /><circle cx="12" cy="12" r="2" strokeWidth={1.5} /></svg>
              <span>목표로 추가</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
