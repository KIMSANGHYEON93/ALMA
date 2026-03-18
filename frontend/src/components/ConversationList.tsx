"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
}

interface ConversationListProps {
  token: string;
  activeId: string | null;
  onSelect: (id: string) => void;
}

export default function ConversationList({
  token,
  activeId,
  onSelect,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const fetchConversations = async () => {
    const data = await apiClient<Conversation[]>("/api/conversations/", {
      token,
    });
    setConversations(data);
  };

  const createConversation = async () => {
    const data = await apiClient<Conversation>("/api/conversations/", {
      method: "POST",
      token,
      body: { title: null },
    });
    setConversations((prev) => [data, ...prev]);
    onSelect(data.id);
  };

  useEffect(() => {
    fetchConversations();
  }, [token]);

  return (
    <aside className="w-72 border-r dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900">
      <div className="p-4 border-b dark:border-gray-800">
        <button
          onClick={createConversation}
          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
        >
          + 새 대화
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
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
