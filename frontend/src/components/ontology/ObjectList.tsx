import type { OntologyNode } from "@/lib/types";

// WCAG AA compliant with white text (≥4.5:1)
const CATEGORY_COLORS: Record<string, string> = {
  Entity: "bg-sky-700",
  Action: "bg-green-700",
  Concept: "bg-purple-700",
  Attribute: "bg-orange-700",
  Temporal: "bg-cyan-700",
};

export default function ObjectList({ objects, loading }: { objects: OntologyNode[]; loading: boolean }) {
  if (loading) return <div className="text-gray-400">로딩 중...</div>;
  if (objects.length === 0) return <div className="text-gray-400">아직 등록된 노드가 없습니다.</div>;

  return (
    <div className="space-y-2">
      {objects.map((obj) => (
        <div key={obj.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <span className={`text-xs px-2 py-1 rounded mr-2 ${CATEGORY_COLORS[obj.parent_category] || "bg-gray-600"}`}>
              {obj.parent_category}
            </span>
            <span className="font-medium">{obj.name}</span>
            <span className="text-gray-400 text-sm ml-2">({obj.type_name})</span>
          </div>
          <div className="text-sm text-gray-400">
            {(obj.confidence * 100).toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  );
}
