"use client";

import { useCallback, useRef, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import type { GraphNodeData, GraphLinkData } from "@/lib/types";

// Dynamic import with SSR disabled - react-force-graph uses Canvas/WebGL
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface GraphViewProps {
  nodes: GraphNodeData[];
  links: GraphLinkData[];
  selectedNodeId: string | null;
  onNodeClick: (node: GraphNodeData) => void;
  onBackgroundClick: () => void;
  searchQuery: string;
  width: number;
  height: number;
}

// The library uses generic node/link objects with [others: string]: any
// We cast to our types inside callbacks
type ForceNode = { [key: string]: unknown; id?: string | number; x?: number; y?: number };
type ForceLink = { [key: string]: unknown; source?: string | number | ForceNode; target?: string | number | ForceNode };

export default function GraphView({
  nodes,
  links,
  selectedNodeId,
  onNodeClick,
  onBackgroundClick,
  searchQuery,
  width,
  height,
}: GraphViewProps) {
  const fgRef = useRef(undefined);

  // Build neighbor sets for selected node highlight
  const { neighborIds, selectedLinkSet } = useMemo(() => {
    if (!selectedNodeId)
      return { neighborIds: new Set<string>(), selectedLinkSet: new Set<string>() };

    const nIds = new Set<string>([selectedNodeId]);
    const lSet = new Set<string>();

    links.forEach((l) => {
      const src = typeof l.source === "object" ? (l.source as GraphNodeData).id : l.source;
      const tgt = typeof l.target === "object" ? (l.target as GraphNodeData).id : l.target;
      if (src === selectedNodeId || tgt === selectedNodeId) {
        nIds.add(src);
        nIds.add(tgt);
        lSet.add(`${src}-${tgt}`);
      }
    });

    return { neighborIds: nIds, selectedLinkSet: lSet };
  }, [selectedNodeId, links]);

  // Search match set
  const searchMatchIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    return new Set(
      nodes.filter((n) => n.name.toLowerCase().includes(q)).map((n) => n.id)
    );
  }, [searchQuery, nodes]);

  // Zoom to fit on data change
  useEffect(() => {
    const timer = setTimeout(() => {
      const fg = fgRef.current as { zoomToFit?: (ms: number, padding: number) => void } | undefined;
      if (fg?.zoomToFit) {
        fg.zoomToFit(400, 50);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [nodes.length]);

  const nodeCanvasObject = useCallback(
    (rawNode: ForceNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const node = rawNode as unknown as GraphNodeData;
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const r = node.val;
      const isSearchMatch = searchMatchIds.has(node.id);
      const isSelected = node.id === selectedNodeId;
      const isNeighbor = neighborIds.has(node.id);
      const isFaded = selectedNodeId !== null && !isNeighbor;

      ctx.save();

      if (isFaded) {
        ctx.globalAlpha = 0.1;
      }

      // Search highlight ring
      if (isSearchMatch) {
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, 2 * Math.PI);
        ctx.fillStyle = "#FBBF24";
        ctx.fill();
      }

      // Selected highlight ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, r + 2, 0, 2 * Math.PI);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Label at sufficient zoom
      if (globalScale > 1.5 || isSelected || isSearchMatch) {
        const label = node.name;
        const fontSize = Math.max(10 / globalScale, 3);
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isFaded ? "rgba(255,255,255,0.1)" : "#fff";
        ctx.fillText(label, x, y + r + 2);
      }

      ctx.restore();
    },
    [selectedNodeId, neighborIds, searchMatchIds]
  );

  const nodePointerAreaPaint = useCallback(
    (rawNode: ForceNode, color: string, ctx: CanvasRenderingContext2D) => {
      const node = rawNode as unknown as GraphNodeData;
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const r = node.val + 4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  const linkColor = useCallback(
    (rawLink: ForceLink) => {
      if (!selectedNodeId) return "rgba(255,255,255,0.15)";

      const src = typeof rawLink.source === "object"
        ? String((rawLink.source as ForceNode).id ?? "")
        : String(rawLink.source);
      const tgt = typeof rawLink.target === "object"
        ? String((rawLink.target as ForceNode).id ?? "")
        : String(rawLink.target);
      const key = `${src}-${tgt}`;
      return selectedLinkSet.has(key)
        ? "rgba(255,255,255,0.6)"
        : "rgba(255,255,255,0.05)";
    },
    [selectedNodeId, selectedLinkSet]
  );

  const graphData = useMemo(
    () => ({ nodes, links }),
    [nodes, links]
  );

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor="#030712"
      nodeCanvasObject={nodeCanvasObject}
      nodePointerAreaPaint={nodePointerAreaPaint}
      linkColor={linkColor}
      linkDirectionalArrowLength={4}
      linkDirectionalArrowRelPos={0.9}
      onNodeClick={(node) => onNodeClick(node as unknown as GraphNodeData)}
      onBackgroundClick={onBackgroundClick}
      warmupTicks={50}
      cooldownTicks={100}
      nodeId="id"
      nodeVal="val"
    />
  );
}
