"use client";

import { useState } from "react";
import ChatWindow from "@/components/ChatWindow";
import ConversationList from "@/components/ConversationList";
import NavBar from "@/components/common/NavBar";
import Spinner from "@/components/common/Spinner";
import { useAuth } from "@/contexts/AuthContext";

export default function ChatPage() {
  const { token, isLoading } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);

  if (isLoading || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="md" label="로딩 중" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <NavBar />
      <div className="flex flex-1 overflow-hidden">
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
    </div>
  );
}
