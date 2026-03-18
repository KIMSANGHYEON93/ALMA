"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
}

interface ConversationListProps {
  activeId: string | null;
  onSelect: (id: string) => void;
}

export default function ConversationList({
  activeId,
  onSelect,
}: ConversationListProps) {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiClient<Conversation[]>("/api/conversations", {
        token,
      });
      setConversations(data);
    } catch {
      // 401 → api.ts에서 로그인 리다이렉트 처리됨
    }
  }, [token]);

  const createConversation = async () => {
    if (!token || isCreating) return;
    setIsCreating(true);
    try {
      const data = await apiClient<Conversation>("/api/conversations", {
        method: "POST",
        token,
        body: { title: null },
      });
      setConversations((prev) => [data, ...prev]);
      onSelect(data.id);
    } catch {
      // 401 → api.ts에서 로그인 리다이렉트 처리됨
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <aside className="w-72 border-r dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900">
      <div className="p-4 border-b dark:border-gray-800">
        <button
          onClick={createConversation}
          disabled={isCreating}
          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
        >
          {isCreating ? "생성 중..." : "+ 새 대화"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            aria-current={activeId === conv.id ? "true" : undefined}
            className={`w-full text-left px-4 py-3 border-b dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-sm ${
              activeId === conv.id
                ? "bg-blue-50 dark:bg-gray-800 font-medium"
                : ""
            }`}
          >
            {conv.title || "새 대화"}
          </button>
        ))}
      </div>
    </aside>
  );
}
