"use client";

import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { authFetcher, errMessage, swrDefaults, type AuthKey } from "@/lib/swr";
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

export function useImportSources() {
  const { token } = useAuth();
  const key: AuthKey | null = token
    ? ["/api/ontology/import/sources", token]
    : null;
  const { data, isLoading, error, mutate } = useSWR<ImportSourceItem[]>(
    key,
    authFetcher,
    swrDefaults
  );

  return {
    sources: data ?? [],
    loading: isLoading,
    error: errMessage(error, "임포트 소스 조회 실패"),
    refresh: () => mutate(),
  };
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
