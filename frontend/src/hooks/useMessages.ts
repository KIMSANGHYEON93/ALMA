import { useState, useCallback, type RefObject } from "react";
import { apiClient } from "@/lib/api";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface MessagesPageResponse {
  messages: {
    id: string;
    role: string;
    content: string;
    created_at: string;
  }[];
  has_more: boolean;
}

export function useMessages(
  conversationId: string,
  token: string,
  scrollContainerRef: RefObject<HTMLDivElement | null>
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setMessages([]);
    setHasMore(false);

    try {
      const data = await apiClient<MessagesPageResponse>(
        `/api/conversations/${conversationId}/messages?limit=20`,
        { token }
      );

      setMessages(
        data.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
      setHasMore(data.has_more);
    } catch (error) {
      // error logged silently in production
    } finally {
      setIsLoadingHistory(false);
    }
  }, [conversationId, token]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || messages.length === 0) return;

    setIsLoadingMore(true);

    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;

    try {
      const oldestId = messages[0].id;
      const data = await apiClient<MessagesPageResponse>(
        `/api/conversations/${conversationId}/messages?limit=20&before=${oldestId}`,
        { token }
      );

      setMessages((prev) => [
        ...data.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        ...prev,
      ]);
      setHasMore(data.has_more);

      // 스크롤 위치 복원: 새 메시지가 위에 추가된 만큼 스크롤 유지
      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - prevScrollHeight;
        }
      });
    } catch (error) {
      // error logged silently in production
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, messages, conversationId, token, scrollContainerRef]);

  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  return {
    messages,
    hasMore,
    isLoadingHistory,
    isLoadingMore,
    loadHistory,
    loadMore,
    addMessage,
  };
}
