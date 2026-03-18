"use client";

import { useState } from "react";
import ChatWindow from "@/components/ChatWindow";
import ConversationList from "@/components/ConversationList";
import { useAuth } from "@/contexts/AuthContext";

export default function ChatPage() {
  const { token, isLoading } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);

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
