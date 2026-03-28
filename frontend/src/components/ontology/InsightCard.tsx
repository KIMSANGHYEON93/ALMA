"use client";

import type { OntologyInsight } from "@/lib/types";

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  hub_node: { label: "허브", color: "bg-blue-600" },
  isolated: { label: "고립", color: "bg-yellow-600" },
  strong_path: { label: "경로", color: "bg-green-600" },
  conflict: { label: "상충", color: "bg-red-600" },
  opportunity: { label: "기회", color: "bg-purple-600" },
  trend: { label: "추세", color: "bg-cyan-600" },
};

const STATUS_CONFIG: Record<string, { label: string; nextStatus: string; btnColor: string }> = {
  new: { label: "읽음으로 표시", nextStatus: "read", btnColor: "bg-gray-700 hover:bg-gray-600" },
  read: { label: "조치 완료", nextStatus: "acted", btnColor: "bg-green-700 hover:bg-green-600" },
  acted: { label: "완료됨", nextStatus: "acted", btnColor: "bg-green-800 cursor-default" },
};

interface InsightCardProps {
  insight: OntologyInsight;
  onStatusChange: (id: string, status: string) => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
}

export default function InsightCard({ insight, onStatusChange, onDismiss }: InsightCardProps) {
  const typeConf = TYPE_CONFIG[insight.insight_type] ?? { label: insight.insight_type, color: "bg-gray-600" };
  const statusConf = STATUS_CONFIG[insight.status] ?? STATUS_CONFIG["read"];

  const confidencePct = Math.round(insight.confidence * 100);
  const confidenceColor =
    insight.confidence >= 0.8
      ? "text-green-400"
      : insight.confidence >= 0.5
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${typeConf.color}`}>
            {typeConf.label}
          </span>
          {insight.status === "new" && (
            <span className="text-xs px-2 py-0.5 rounded font-medium bg-orange-600">NEW</span>
          )}
        </div>
        <span className={`text-xs font-mono font-bold ${confidenceColor}`}>
          {confidencePct}%
        </span>
      </div>

      {/* Title & Description */}
      <div>
        <h3 className="font-semibold text-white text-sm mb-1">{insight.title}</h3>
        <p className="text-gray-400 text-xs leading-relaxed">{insight.description}</p>
      </div>

      {/* Action suggestion */}
      {insight.actionable && insight.action_suggestion && (
        <div className="bg-green-950 border border-green-800 rounded p-2">
          <p className="text-green-300 text-xs">
            <span className="font-semibold">권장 조치: </span>
            {insight.action_suggestion}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {insight.status !== "acted" && insight.status !== "dismissed" && (
          <button
            onClick={() => onStatusChange(insight.id, statusConf.nextStatus)}
            className={`text-xs px-3 py-1 rounded transition ${statusConf.btnColor}`}
          >
            {statusConf.label}
          </button>
        )}
        {insight.status !== "dismissed" && (
          <button
            onClick={() => onDismiss(insight.id)}
            className="text-xs px-3 py-1 rounded bg-gray-800 hover:bg-red-900 text-gray-400 hover:text-red-300 transition"
          >
            닫기
          </button>
        )}
        <span className="text-xs text-gray-600 ml-auto">
          {new Date(insight.created_at).toLocaleDateString("ko-KR")}
        </span>
      </div>
    </div>
  );
}
