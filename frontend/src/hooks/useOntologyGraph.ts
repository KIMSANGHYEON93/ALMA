"use client";

import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { errMessage, swrDefaults } from "@/lib/swr";
import type { OntologyGraph, GraphNodeData, GraphLinkData } from "@/lib/types";
import {
  ONTOLOGY_CATEGORY_COLORS,
  ONTOLOGY_CATEGORY_FALLBACK,
} from "@/lib/ontology-palette";

type GraphData = { nodes: GraphNodeData[]; links: GraphLinkData[] };

const EMPTY_GRAPH: GraphData = { nodes: [], links: [] };

function transformGraphData(graph: OntologyGraph): GraphData {
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
    color:
      ONTOLOGY_CATEGORY_COLORS[n.parent_category] ||
      ONTOLOGY_CATEGORY_FALLBACK,
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

  const key = token ? (["/api/ontology/graph", token] as const) : null;
  const { data, isLoading, error, mutate } = useSWR<GraphData>(
    key,
    async ([url, t]: readonly [string, string]): Promise<GraphData> => {
      const graph = await apiClient<OntologyGraph>(url, { token: t });
      return transformGraphData(graph);
    },
    swrDefaults
  );

  return {
    graphData: data ?? EMPTY_GRAPH,
    loading: isLoading,
    error: errMessage(error, "그래프 조회 실패"),
    refresh: () => mutate(),
  };
}
