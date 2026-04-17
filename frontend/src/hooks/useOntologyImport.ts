"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import type {
  ScanResponse,
  ProcessResponse,
  ImportSourceItem,
  BrowseResponse,
} from "@/lib/types";

export async function browseDirectory(
  path: string,
  token: string
): Promise<BrowseResponse> {
  return apiClient<BrowseResponse>("/api/ontology/import/browse", {
    method: "POST",
    token,
    body: { path },
  });
}

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

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || /aborted/i.test(err.message));
}

export function useImportSources() {
  const { token } = useAuth();
  const [sources, setSources] = useState<ImportSourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSources = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      setError(null);
      try {
        setLoading(true);
        const data = await apiClient<ImportSourceItem[]>(
          "/api/ontology/import/sources",
          { token, signal }
        );
        setSources(data);
      } catch (err) {
        if (!isAbortError(err)) {
          setError(err instanceof Error ? err.message : "임포트 소스 조회 실패");
        }
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchSources(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchSources]);

  return { sources, loading, error, refresh: () => fetchSources() };
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
