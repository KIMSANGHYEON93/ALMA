/**
 * Ontology node category color palette.
 *
 * WCAG AA compliant (≥4.5:1 contrast with white text).
 * Tailwind 700 shades chosen for perceptual distinctness while meeting AA.
 *
 * Single source of truth — imported by:
 * - `hooks/useOntologyGraph.ts` (force graph node fill)
 * - `components/ontology/GraphToolbar.tsx` (category filter buttons)
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
