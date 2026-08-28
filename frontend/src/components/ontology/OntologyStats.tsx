import type { OntologyStats as StatsType } from "@/lib/types";

export default function OntologyStats({ stats }: { stats: StatsType }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-400">전체 노드</div>
        <div className="text-2xl font-bold">{stats.total_nodes}</div>
      </div>
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-400">전체 링크</div>
        <div className="text-2xl font-bold">{stats.total_edges}</div>
      </div>
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-400">드래프트</div>
        <div className="text-2xl font-bold text-yellow-400">{stats.draft_count}</div>
      </div>
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-400">평균 신뢰도</div>
        <div className="text-2xl font-bold">{(stats.avg_confidence * 100).toFixed(0)}%</div>
      </div>
    </div>
  );
}
