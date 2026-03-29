"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import type {
  ScanResponse,
  ProcessResponse,
  ImportSourceItem,
} from "@/lib/types";

export async function scanDirectory(
  directory: string,
  pattern: string,
  token: string
): Promise<ScanResponse> {
  return apiClient<ScanResponse>("/api/ontology/import/scan", {
    method: "POST",
    token,
    body: { directory, pattern },
  });
}

export async function processFiles(
  directory: string,
  paths: string[],
  token: string
): Promise<ProcessResponse> {
  return apiClient<ProcessResponse>("/api/ontology/import/process", {
    method: "POST",
    token,
    body: { directory, paths },
  });
}

export async function importDB(
  sourceTypes: string[],
  token: string
): Promise<ProcessResponse> {
  return apiClient<ProcessResponse>("/api/ontology/import/db", {
    method: "POST",
    token,
    body: { source_types: sourceTypes },
  });
}

export function useImportSources() {
  const { token } = useAuth();
  const [sources, setSources] = useState<ImportSourceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSources = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await apiClient<ImportSourceItem[]>(
        "/api/ontology/import/sources",
        { token }
      );
      setSources(data);
    } catch {
      // 401 handled by apiClient
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  return { sources, loading, refresh: fetchSources };
}

export async function deleteImportSource(
  id: string,
  token: string
): Promise<void> {
  return apiClient<void>(`/api/ontology/import/sources/${id}`, {
    method: "DELETE",
    token,
  });
}
