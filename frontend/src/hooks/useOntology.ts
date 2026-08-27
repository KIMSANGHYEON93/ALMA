"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { OntologyNode, OntologyStats, OntologyObjectType, OntologyLinkType } from "@/lib/types";

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));
}

export function useOntologyStats() {
  const { token } = useAuth();
  const [stats, setStats] = useState<OntologyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      setError(null);
      try {
        const res = await apiClient<OntologyStats>("/api/ontology/stats", { token, signal });
        setStats(res);
      } catch (err) {
        if (!isAbortError(err)) {
          setError(err instanceof Error ? err.message : "통계 조회 실패");
        }
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchStats(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchStats]);

  return { stats, loading, error, refresh: () => fetchStats() };
}

export function useOntologyObjects(params?: { status?: string; type_id?: string }) {
  const { token } = useAuth();
  const status = params?.status;
  const typeId = params?.type_id;
  const [objects, setObjects] = useState<OntologyNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchObjects = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      setError(null);
      try {
        const searchParams = new URLSearchParams();
        if (status) searchParams.set("status", status);
        if (typeId) searchParams.set("type_id", typeId);
        const qs = searchParams.toString();
        const url = `/api/ontology/objects${qs ? "?" + qs : ""}`;
        const res = await apiClient<OntologyNode[]>(url, { token, signal });
        setObjects(res);
      } catch (err) {
        if (!isAbortError(err)) {
          setError(err instanceof Error ? err.message : "노드 조회 실패");
        }
      } finally {
        setLoading(false);
      }
    },
    [token, status, typeId]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchObjects(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchObjects]);

  return { objects, loading, error, refresh: () => fetchObjects() };
}

export function useOntologyTypes() {
  const { token } = useAuth();
  const [objectTypes, setObjectTypes] = useState<OntologyObjectType[]>([]);
  const [linkTypes, setLinkTypes] = useState<OntologyLinkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await apiClient<{ object_types: OntologyObjectType[]; link_types: OntologyLinkType[] }>(
          "/api/ontology/types",
          { token, signal: ctrl.signal }
        );
        setObjectTypes(res.object_types || []);
        setLinkTypes(res.link_types || []);
      } catch (err) {
        if (!isAbortError(err)) {
          setError(err instanceof Error ? err.message : "타입 조회 실패");
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [token]);

  return { objectTypes, linkTypes, loading, error };
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
