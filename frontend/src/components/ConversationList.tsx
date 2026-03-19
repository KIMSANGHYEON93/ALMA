"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
}

interface ConversationListProps {
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

export default function ConversationList({
  activeId,
  onSelect,
}: ConversationListProps) {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiClient<Conversation[]>("/api/conversations", {
        token,
      });
      setConversations(data);
    } catch {
      // 401 handled
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
      // 401 handled
    } finally {
      setIsCreating(false);
    }
  };

  const renameConversation = async (id: string, title: string) => {
    if (!token || !title.trim()) return;
    try {
      const updated = await apiClient<Conversation>(
        `/api/conversations/${id}`,
        { method: "PATCH", token, body: { title: title.trim() } }
      );
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: updated.title } : c))
      );
    } catch {
      // revert
    }
    setEditingId(null);
  };

  const deleteConversation = async (id: string) => {
    if (!token) return;
    try {
      await apiClient<void>(`/api/conversations/${id}`, {
        method: "DELETE",
        token,
      });
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (activeId === id) {
        onSelect(remaining.length > 0 ? remaining[0].id : null as unknown as string);
      }
    } catch {
      // handled
    }
    setDeleteConfirmId(null);
  };

  const startEdit = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title || "");
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // 제목 자동 갱신 (첫 메시지 후 서버에서 제목 생성됨)
  useEffect(() => {
    if (!activeId) return;
    const timer = setTimeout(() => fetchConversations(), 3000);
    return () => clearTimeout(timer);
  }, [activeId, fetchConversations]);

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
          <div
            key={conv.id}
            className={`group relative border-b dark:border-gray-800 ${
              activeId === conv.id
                ? "bg-blue-50 dark:bg-gray-800"
                : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
            }`}
          >
            {editingId === conv.id ? (
              /* 인라인 편집 모드 */
              <div className="px-3 py-2">
                <input
                  ref={editInputRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameConversation(conv.id, editTitle);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={() => renameConversation(conv.id, editTitle)}
                  className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ) : deleteConfirmId === conv.id ? (
              /* 삭제 확인 모드 */
              <div className="px-3 py-2 space-y-2">
                <p className="text-xs text-red-500">이 대화를 삭제하시겠습니까?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteConversation(conv.id)}
                    className="flex-1 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition"
                  >
                    삭제
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 py-1 text-xs border dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              /* 기본 표시 모드 */
              <button
                onClick={() => onSelect(conv.id)}
                onDoubleClick={() => startEdit(conv)}
                aria-current={activeId === conv.id ? "true" : undefined}
                className="w-full text-left px-4 py-3 transition text-sm pr-16"
              >
                <span className={activeId === conv.id ? "font-medium" : ""}>
                  {conv.title || "새 대화"}
                </span>
              </button>
            )}

            {/* 호버 시 편집/삭제 아이콘 */}
            {editingId !== conv.id && deleteConfirmId !== conv.id && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(conv);
                  }}
                  className="p-1 text-gray-400 hover:text-blue-500 transition"
                  title="이름 변경"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirmId(conv.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 transition"
                  title="삭제"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
