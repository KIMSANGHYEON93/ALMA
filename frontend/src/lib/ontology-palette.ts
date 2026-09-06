/**
 * Ontology node category color palette.
 *
 * WCAG AA compliant (≥4.5:1 contrast with white text).
 * Tailwind 700 shades chosen for perceptual distinctness while meeting AA.
 *
 * Single source of truth — imported by:
 * - `hooks/useOntologyGraph.ts` (force graph node fill)
 * - `components/ontology/GraphToolbar.tsx` (category filter buttons)
 * - `components/ontology/NodeDetailPanel.tsx`, `ObjectList.tsx` (category badge)
 * - `app/ontology/graph/page.tsx` (initial + reset filter state)
 * - `lib/a11y.ts` (graph screen reader summary)
 */
export const ONTOLOGY_CATEGORY_COLORS: Record<string, string> = {
  Entity: "#1D4ED8",    // blue-700,   6.04:1
  Action: "#15803D",    // green-700,  4.93:1
  Concept: "#7E22CE",   // purple-700, 6.32:1
  Attribute: "#C2410C", // orange-700, 4.58:1
  Temporal: "#0E7490",  // cyan-700,   5.56:1
};

export const ONTOLOGY_CATEGORY_FALLBACK = "#6B7280"; // gray-500

export const ONTOLOGY_CATEGORIES = [
  "Entity",
  "Action",
  "Concept",
  "Attribute",
  "Temporal",
] as const;

/**
 * Korean display labels for the categories above.
 *
 * The category keys stay English on the wire — the backend validates them
 * (`domain/ontology/validator.py: VALID_CATEGORIES`) and persists them as-is.
 * Only what the user sees or hears is translated, so screen and screen reader
 * always speak the same words.
 */
export const ONTOLOGY_CATEGORY_LABELS: Record<string, string> = {
  Entity: "개체",
  Action: "행동",
  Concept: "개념",
  Attribute: "속성",
  Temporal: "시간",
};

export const ONTOLOGY_CATEGORY_LABEL_FALLBACK = "기타";

/** Unknown categories fall back to the raw key so nothing is silently hidden. */
export function ontologyCategoryLabel(category: string | null | undefined): string {
  if (!category) return ONTOLOGY_CATEGORY_LABEL_FALLBACK;
  return ONTOLOGY_CATEGORY_LABELS[category] ?? category;
}
