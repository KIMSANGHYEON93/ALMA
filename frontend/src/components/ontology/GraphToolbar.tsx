"use client";

import Link from "next/link";
import {
  ONTOLOGY_CATEGORIES,
  ONTOLOGY_CATEGORY_COLORS,
  ontologyCategoryLabel,
} from "@/lib/ontology-palette";

const CATEGORIES = ONTOLOGY_CATEGORIES.map((key) => ({
  key,
  label: ontologyCategoryLabel(key),
  color: ONTOLOGY_CATEGORY_COLORS[key],
}));

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
        {CATEGORIES.map(({ key, label, color }) => {
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
              {label}
            </button>
          );
        })}
      </div>

      {/* Confidence slider — toolbar is always bg-gray-900 so text is fixed light */}
      <div className="flex items-center gap-2 text-xs text-gray-300">
        <label htmlFor="graph-confidence-slider">신뢰도</label>
        <input
          id="graph-confidence-slider"
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={confidenceMin}
          onChange={(e) => onConfidenceChange(parseFloat(e.target.value))}
          aria-label="최소 신뢰도 기준"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={confidenceMin}
          className="w-24 accent-sky-500"
        />
        <span className="w-8 text-right" aria-hidden="true">{confidenceMin.toFixed(1)}</span>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="노드 검색..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="px-3 py-1 rounded bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 w-48"
      />

      {/* Reset */}
      <button
        onClick={onReset}
        className="px-3 py-1 rounded bg-gray-800 text-xs text-gray-400 hover:text-white hover:bg-gray-700 transition"
      >
        초기화
      </button>

      {/* List View link */}
      <Link
        href="/ontology"
        className="ml-auto px-3 py-1 rounded bg-gray-800 text-xs text-gray-400 hover:text-white hover:bg-gray-700 transition"
      >
        목록 보기
      </Link>
    </div>
  );
}
