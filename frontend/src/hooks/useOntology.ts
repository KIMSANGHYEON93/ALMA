"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { OntologyNode, OntologyStats, OntologyObjectType, OntologyLinkType } from "@/lib/types";

export function useOntologyStats() {
  const { token } = useAuth();
  const [stats, setStats] = useState<OntologyStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiClient<OntologyStats>("/api/ontology/stats", { token });
      setStats(res);
    } catch {
      // 401 handled by apiClient
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  return { stats, loading, refresh: fetchStats };
}

export function useOntologyObjects(params?: { status?: string; type_id?: string }) {
  const { token } = useAuth();
  const [objects, setObjects] = useState<OntologyNode[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchObjects = useCallback(async () => {
    if (!token) return;
    try {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set("status", params.status);
      if (params?.type_id) searchParams.set("type_id", params.type_id);
      const qs = searchParams.toString();
      const url = `/api/ontology/objects${qs ? "?" + qs : ""}`;
      const res = await apiClient<OntologyNode[]>(url, { token });
      setObjects(res);
    } catch {
      // 401 handled by apiClient
    } finally {
      setLoading(false);
    }
  }, [token, params?.status, params?.type_id]);

  useEffect(() => { fetchObjects(); }, [fetchObjects]);
  return { objects, loading, refresh: fetchObjects };
}

export function useOntologyTypes() {
  const { token } = useAuth();
  const [objectTypes, setObjectTypes] = useState<OntologyObjectType[]>([]);
  const [linkTypes, setLinkTypes] = useState<OntologyLinkType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await apiClient<{ object_types: OntologyObjectType[]; link_types: OntologyLinkType[] }>(
          "/api/ontology/types",
          { token }
        );
        setObjectTypes(res.object_types || []);
        setLinkTypes(res.link_types || []);
      } catch {
        // 401 handled by apiClient
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return { objectTypes, linkTypes, loading };
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
