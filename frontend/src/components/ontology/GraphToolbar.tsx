"use client";

import Link from "next/link";

const CATEGORIES = [
  { key: "Entity", color: "#3B82F6" },
  { key: "Action", color: "#22C55E" },
  { key: "Concept", color: "#A855F7" },
  { key: "Attribute", color: "#F97316" },
  { key: "Temporal", color: "#06B6D4" },
] as const;

interface GraphToolbarProps {
  activeCategories: Set<string>;
  onToggleCategory: (category: string) => void;
  confidenceMin: number;
  onConfidenceChange: (value: number) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onReset: () => void;
}

export default function GraphToolbar({
  activeCategories,
  onToggleCategory,
  confidenceMin,
  onConfidenceChange,
  searchQuery,
  onSearchChange,
  onReset,
}: GraphToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-800 flex-wrap">
      {/* Category toggles */}
      <div className="flex items-center gap-1">
        {CATEGORIES.map(({ key, color }) => {
          const active = activeCategories.has(key);
          return (
            <button
              key={key}
              onClick={() => onToggleCategory(key)}
              className="px-2.5 py-1 rounded text-xs font-medium transition-opacity"
              style={{
                backgroundColor: active ? color : "transparent",
                color: active ? "#fff" : color,
                border: `1px solid ${color}`,
                opacity: active ? 1 : 0.4,
              }}
            >
              {key}
            </button>
          );
        })}
      </div>

      {/* Confidence slider */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>Confidence</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={confidenceMin}
          onChange={(e) => onConfidenceChange(parseFloat(e.target.value))}
          className="w-24 accent-blue-500"
        />
        <span className="w-8 text-right">{confidenceMin.toFixed(1)}</span>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search nodes..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="px-3 py-1 rounded bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-48"
      />

      {/* Reset */}
      <button
        onClick={onReset}
        className="px-3 py-1 rounded bg-gray-800 text-xs text-gray-400 hover:text-white hover:bg-gray-700 transition"
      >
        Reset
      </button>

      {/* List View link */}
      <Link
        href="/ontology"
        className="ml-auto px-3 py-1 rounded bg-gray-800 text-xs text-gray-400 hover:text-white hover:bg-gray-700 transition"
      >
        List View
      </Link>
    </div>
  );
}
