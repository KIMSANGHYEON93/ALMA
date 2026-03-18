"use client";

import { useEffect, useState } from "react";
import ChatWindow from "@/components/ChatWindow";
import ConversationList from "@/components/ConversationList";
import { getToken } from "@/lib/auth";

export default function ChatPage() {
  const [token, setToken] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = getToken();
    setToken(saved);
    setIsLoading(false);
    if (!saved) {
      window.location.href = "/login";
    }
  }, []);

  if (isLoading || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-400">로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <ConversationList
        token={token}
        activeId={conversationId}
        onSelect={setConversationId}
      />
      <main className="flex-1">
        {conversationId ? (
          <ChatWindow token={token} conversationId={conversationId} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            대화를 선택하거나 새로 시작하세요
          </div>
        )}
      </main>
    </div>
  );
}
