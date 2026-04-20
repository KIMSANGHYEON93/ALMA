"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import type { OntologyGraph, GraphNodeData, GraphLinkData } from "@/lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  Entity: "#3B82F6",
  Action: "#22C55E",
  Concept: "#A855F7",
  Attribute: "#F97316",
  Temporal: "#06B6D4",
};

function transformGraphData(graph: OntologyGraph): {
  nodes: GraphNodeData[];
  links: GraphLinkData[];
} {
  const edgeCounts = new Map<string, number>();
  graph.edges.forEach((e) => {
    edgeCounts.set(e.source_id, (edgeCounts.get(e.source_id) || 0) + 1);
    edgeCounts.set(e.target_id, (edgeCounts.get(e.target_id) || 0) + 1);
  });

  const nodes: GraphNodeData[] = graph.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    typeName: n.type_name,
    parentCategory: n.parent_category,
    properties: n.properties,
    confidence: n.confidence,
    status: n.status,
    val: Math.max(4, Math.min(20, 4 + (edgeCounts.get(n.id) || 0) * 2)),
    color: CATEGORY_COLORS[n.parent_category] || "#6B7280",
  }));

  const links: GraphLinkData[] = graph.edges.map((e) => ({
    source: e.source_id,
    target: e.target_id,
    relation: e.relation,
    confidence: e.confidence,
    properties: e.properties,
  }));

  return { nodes, links };
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));
}

export function useOntologyGraph() {
  const { token } = useAuth();
  const [graphData, setGraphData] = useState<{
    nodes: GraphNodeData[];
    links: GraphLinkData[];
  }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      setError(null);
      try {
        setLoading(true);
        const data = await apiClient<OntologyGraph>("/api/ontology/graph", {
          token,
          signal,
        });
        setGraphData(transformGraphData(data));
      } catch (err) {
        if (!isAbortError(err)) {
          setError(err instanceof Error ? err.message : "그래프 조회 실패");
        }
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchGraph(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchGraph]);

  return { graphData, loading, error, refresh: () => fetchGraph() };
}
