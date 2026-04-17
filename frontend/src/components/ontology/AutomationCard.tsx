"use client";

import type { OntologyAutomation } from "@/lib/types";

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  hub_node: { label: "허브", color: "bg-sky-600" },
  isolated: { label: "고립", color: "bg-yellow-600" },
  strong_path: { label: "경로", color: "bg-green-600" },
  conflict: { label: "상충", color: "bg-red-600" },
  opportunity: { label: "기회", color: "bg-purple-600" },
  trend: { label: "추세", color: "bg-cyan-600" },
};

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  create_link: { label: "링크 생성", color: "bg-sky-600" },
  create_node: { label: "노드 생성", color: "bg-green-600" },
  notification: { label: "알림", color: "bg-yellow-600" },
  suggest: { label: "제안", color: "bg-purple-600" },
};

interface AutomationCardProps {
  automation: OntologyAutomation;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function AutomationCard({ automation, onToggle, onDelete }: AutomationCardProps) {
  const typeConf = TYPE_CONFIG[automation.insight_type] ?? {
    label: automation.insight_type,
    color: "bg-gray-600",
  };
  const actionConf = ACTION_CONFIG[automation.action_type] ?? {
    label: automation.action_type,
    color: "bg-gray-700",
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-white text-sm flex-1 truncate">{automation.name}</h3>
        {/* Toggle switch */}
        <button
          role="switch"
          aria-checked={automation.enabled}
          onClick={() => onToggle(automation.id, !automation.enabled)}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
            automation.enabled ? "bg-green-500" : "bg-gray-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
              automation.enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${typeConf.color}`}>
          {typeConf.label}
        </span>
        <span className="text-xs text-gray-500">→</span>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${actionConf.color}`}>
          {actionConf.label}
        </span>
        {automation.auto_execute && (
          <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-700 text-amber-200 ml-auto">
            자동 실행
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-500">
          {new Date(automation.created_at).toLocaleDateString("ko-KR")}
        </span>
        <button
          onClick={() => onDelete(automation.id)}
          className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-red-900 text-gray-400 hover:text-red-300 transition"
        >
          삭제
        </button>
      </div>
    </div>
  );
}
