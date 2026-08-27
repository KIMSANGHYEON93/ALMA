"use client";

import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { authFetcher, errMessage, swrDefaults, type AuthKey } from "@/lib/swr";
import { useAuth } from "@/contexts/AuthContext";
import type {
  OntologyNode,
  OntologyStats,
  OntologyObjectType,
  OntologyLinkType,
} from "@/lib/types";

export function useOntologyStats() {
  const { token } = useAuth();
  const key: AuthKey | null = token ? ["/api/ontology/stats", token] : null;
  const { data, isLoading, error, mutate } = useSWR<OntologyStats>(
    key,
    authFetcher,
    swrDefaults
  );

  return {
    stats: data ?? null,
    loading: isLoading,
    error: errMessage(error, "통계 조회 실패"),
    refresh: () => mutate(),
  };
}

export function useOntologyObjects(params?: {
  status?: string;
  type_id?: string;
}) {
  const { token } = useAuth();
  const status = params?.status;
  const typeId = params?.type_id;

  const searchParams = new URLSearchParams();
  if (status) searchParams.set("status", status);
  if (typeId) searchParams.set("type_id", typeId);
  const qs = searchParams.toString();
  const url = `/api/ontology/objects${qs ? "?" + qs : ""}`;

  const key: AuthKey | null = token ? [url, token] : null;
  const { data, isLoading, error, mutate } = useSWR<OntologyNode[]>(
    key,
    authFetcher,
    swrDefaults
  );

  return {
    objects: data ?? [],
    loading: isLoading,
    error: errMessage(error, "노드 조회 실패"),
    refresh: () => mutate(),
  };
}

type TypesResponse = {
  object_types: OntologyObjectType[];
  link_types: OntologyLinkType[];
};

export function useOntologyTypes() {
  const { token } = useAuth();
  const key: AuthKey | null = token ? ["/api/ontology/types", token] : null;
  const { data, isLoading, error } = useSWR<TypesResponse>(
    key,
    authFetcher,
    swrDefaults
  );

  return {
    objectTypes: data?.object_types ?? [],
    linkTypes: data?.link_types ?? [],
    loading: isLoading,
    error: errMessage(error, "타입 조회 실패"),
  };
}

export async function verifyObject(id: string, token: string) {
  return apiClient<void>(`/api/ontology/objects/${id}/verify`, {
    method: "POST",
    token,
  });
}

export async function archiveObject(id: string, token: string) {
  return apiClient<void>(`/api/ontology/objects/${id}`, {
    method: "DELETE",
    token,
  });
}
