import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  onAddGoal?: (content: string) => void;
}

export default React.memo(function MessageBubble({
  role,
  content,
  onAddGoal,
}: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      aria-label={isUser ? "사용자 메시지" : "AI 응답"}
    >
      <div className="max-w-[70%]">
        <div
          className={`px-4 py-2 rounded-2xl ${
            isUser
              ? "bg-blue-600 text-white rounded-br-md whitespace-pre-wrap"
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
            </div>
          )}
        </div>

        {/* AI 응답에만 "목표로 추가" 버튼 표시 */}
        {!isUser && onAddGoal && (
          <div className="mt-1 flex justify-start">
            <button
              onClick={() => onAddGoal(content)}
              className="text-xs text-gray-400 hover:text-emerald-500 transition flex items-center gap-1 px-1 py-0.5"
            >
              <span>🎯</span>
              <span>목표로 추가</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
