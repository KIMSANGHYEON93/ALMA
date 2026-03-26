"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { KnowledgeDocument } from "@/lib/types";

export function useKnowledge() {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiClient<KnowledgeDocument[]>("/api/knowledge", { token });
      setDocuments(data);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDocs();
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
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    const res = await fetch("/api/knowledge/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    await fetchDocs();
  };

  const deleteDocument = async (id: string) => {
    if (!token) return;
    await apiClient(`/api/knowledge/${id}`, { method: "DELETE", token });
    await fetchDocs();
  };

  return { documents, loading, addDocument, addFromUrl, addFile, deleteDocument, refresh: fetchDocs };
}
