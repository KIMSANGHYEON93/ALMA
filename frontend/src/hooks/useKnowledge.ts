"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, uploadFormData } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { KnowledgeDocument } from "@/lib/types";

export function useKnowledge() {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocs = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      setError(null);
      try {
        const data = await apiClient<KnowledgeDocument[]>("/api/knowledge", { token, signal });
        setDocuments(data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "문서 조회 실패");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchDocs(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchDocs]);

  const addDocument = async (title: string, content: string) => {
    if (!token) return;
    await apiClient<KnowledgeDocument>("/api/knowledge", {
      method: "POST",
      token,
      body: { title, content },
    });
    await fetchDocs();
  };

  const addFromUrl = async (title: string, url: string) => {
    if (!token) return;
    await apiClient<KnowledgeDocument>("/api/knowledge/url", {
      method: "POST",
      token,
      body: { title, url },
    });
    await fetchDocs();
  };

  const addFile = async (title: string, file: File) => {
    if (!token) return;
    await uploadFormData<KnowledgeDocument>("/api/knowledge/upload", () => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title);
      return fd;
    });
    await fetchDocs();
  };

  const deleteDocument = async (id: string) => {
    if (!token) return;
    await apiClient(`/api/knowledge/${id}`, { method: "DELETE", token });
    await fetchDocs();
  };

  return {
    documents,
    loading,
    error,
    addDocument,
    addFromUrl,
    addFile,
    deleteDocument,
    refresh: () => fetchDocs(),
  };
}
