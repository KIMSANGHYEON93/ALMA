"use client";

import useSWR from "swr";
import { apiClient, uploadFormData } from "@/lib/api";
import { authFetcher, errMessage, swrDefaults, type AuthKey } from "@/lib/swr";
import { useAuth } from "@/contexts/AuthContext";
import type { KnowledgeDocument } from "@/lib/types";

const LIST_URL = "/api/knowledge";

export function useKnowledge() {
  const { token } = useAuth();
  const key: AuthKey | null = token ? [LIST_URL, token] : null;
  const { data, isLoading, error, mutate } = useSWR<KnowledgeDocument[]>(
    key,
    authFetcher,
    swrDefaults
  );

  const addDocument = async (title: string, content: string) => {
    if (!token) return;
    await apiClient<KnowledgeDocument>(LIST_URL, {
      method: "POST",
      token,
      body: { title, content },
    });
    await mutate();
  };

  const addFromUrl = async (title: string, url: string) => {
    if (!token) return;
    await apiClient<KnowledgeDocument>("/api/knowledge/url", {
      method: "POST",
      token,
      body: { title, url },
    });
    await mutate();
  };

  const addFile = async (title: string, file: File) => {
    if (!token) return;
    await uploadFormData<KnowledgeDocument>("/api/knowledge/upload", () => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title);
      return fd;
    });
    await mutate();
  };

  const deleteDocument = async (id: string) => {
    if (!token) return;
    await apiClient(`/api/knowledge/${id}`, { method: "DELETE", token });
    await mutate();
  };

  return {
    documents: data ?? [],
    loading: isLoading,
    error: errMessage(error, "문서 조회 실패"),
    addDocument,
    addFromUrl,
    addFile,
    deleteDocument,
    refresh: () => mutate(),
  };
}
