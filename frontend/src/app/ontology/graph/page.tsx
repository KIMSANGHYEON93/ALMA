"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import NavBar from "@/components/common/NavBar";
import GraphView from "@/components/ontology/GraphView";
import GraphToolbar from "@/components/ontology/GraphToolbar";
import NodeDetailPanel from "@/components/ontology/NodeDetailPanel";
import { useOntologyGraph } from "@/hooks/useOntologyGraph";
import { useAuth } from "@/contexts/AuthContext";
import { verifyObject } from "@/hooks/useOntology";
import type { GraphNodeData } from "@/lib/types";
import { ONTOLOGY_CATEGORIES } from "@/lib/ontology-palette";

export default function GraphPage() {
  const { token, isLoading } = useAuth();
  const { graphData, loading, refresh } = useOntologyGraph();

  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    () => new Set<string>(ONTOLOGY_CATEGORIES)
  );
  const [confidenceMin, setConfidenceMin] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Track window size
  useEffect(() => {
    function updateSize() {
      setDimensions({
        width: window.innerWidth,
        // NavBar 56px + Toolbar ~41px
        height: window.innerHeight - 97,
      });
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Adjust for detail panel
  const graphWidth = useMemo(
    () => (selectedNode ? dimensions.width - 320 : dimensions.width),
    [selectedNode, dimensions.width]
  );

  const handleToggleCategory = useCallback((category: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setActiveCategories(new Set<string>(ONTOLOGY_CATEGORIES));
    setConfidenceMin(0);
    setSearchQuery("");
    setSelectedNode(null);
  }, []);

  const handleNodeClick = useCallback((node: GraphNodeData) => {
    setSelectedNode(node);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleVerify = useCallback(
    async (id: string) => {
      if (!token) return;
      try {
        await verifyObject(id, token);
        await refresh();
        setSelectedNode(null);
      } catch {
        // handled by apiClient
      }
    },
    [token, refresh]
  );

  // Filter data client-side
  const filteredNodes = useMemo(() => {
    return graphData.nodes.filter(
      (n) =>
        activeCategories.has(n.parentCategory) &&
        n.confidence >= confidenceMin
    );
  }, [graphData.nodes, activeCategories, confidenceMin]);

  const visibleNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes]
  );

  const filteredLinks = useMemo(() => {
    return graphData.links.filter(
      (l) => visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target)
    );
  }, [graphData.links, visibleNodeIds]);

  if (isLoading || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <span className="text-gray-400">로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      <NavBar />
      <GraphToolbar
        activeCategories={activeCategories}
        onToggleCategory={handleToggleCategory}
        confidenceMin={confidenceMin}
        onConfidenceChange={setConfidenceMin}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onReset={handleReset}
      />

      <div className="relative flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-400">그래프 로딩 중...</span>
          </div>
        ) : filteredNodes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-500">
              표시할 노드가 없습니다. 필터를 조정해보세요.
            </span>
          </div>
        ) : (
          <GraphView
            nodes={filteredNodes}
            links={filteredLinks}
            selectedNodeId={selectedNode?.id ?? null}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            searchQuery={searchQuery}
            width={graphWidth}
            height={dimensions.height}
          />
        )}

        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onVerify={handleVerify}
          />
        )}
      </div>
    </div>
  );
}
