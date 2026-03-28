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

export function useOntologyGraph() {
  const { token } = useAuth();
  const [graphData, setGraphData] = useState<{
    nodes: GraphNodeData[];
    links: GraphLinkData[];
  }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);

  const fetchGraph = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await apiClient<OntologyGraph>("/api/ontology/graph", {
        token,
      });
      setGraphData(transformGraphData(data));
    } catch {
      // 401 handled by apiClient
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  return { graphData, loading, refresh: fetchGraph };
}
