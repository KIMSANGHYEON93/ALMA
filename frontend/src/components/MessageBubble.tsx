import React from "react";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export default React.memo(function MessageBubble({
  role,
  content,
}: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      aria-label={isUser ? "사용자 메시지" : "AI 응답"}
    >
      <div
        className={`max-w-[70%] px-4 py-2 rounded-2xl whitespace-pre-wrap ${
          isUser
            ? "bg-blue-600 text-white rounded-br-md"
            : "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md"
        }`}
      >
        {content}
      </div>
    </div>
  );
});
