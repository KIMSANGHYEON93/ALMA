"use client";

import { useState } from "react";
import Link from "next/link";
import NavBar from "@/components/common/NavBar";
import { useAuth } from "@/contexts/AuthContext";
import {
  useOntologyAutomations,
  useAutomationLogs,
  createAutomation,
  toggleAutomation,
  deleteAutomation,
} from "@/hooks/useOntologyAutomations";
import AutomationCard from "@/components/ontology/AutomationCard";

const INSIGHT_TYPES = [
  { value: "hub_node", label: "허브 노드" },
  { value: "isolated", label: "고립 노드" },
  { value: "strong_path", label: "강한 경로" },
  { value: "conflict", label: "상충 관계" },
  { value: "opportunity", label: "기회 발견" },
  { value: "trend", label: "추세 감지" },
];

const ACTION_TYPES = [
  { value: "create_link", label: "링크 생성" },
  { value: "create_node", label: "노드 생성" },
  { value: "notification", label: "알림" },
  { value: "suggest", label: "제안" },
];

const LOG_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  success: { label: "성공", color: "text-green-400" },
  failed: { label: "실패", color: "text-red-400" },
  pending: { label: "대기", color: "text-yellow-400" },
  skipped: { label: "건너뜀", color: "text-gray-500" },
};

export default function OntologyAutomationsPage() {
  const { isLoading, token } = useAuth();
  const { automations, loading: autoLoading, refresh: refreshAutomations } = useOntologyAutomations();
  const { logs, loading: logsLoading, refresh: refreshLogs } = useAutomationLogs();

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formInsightType, setFormInsightType] = useState(INSIGHT_TYPES[0].value);
  const [formActionType, setFormActionType] = useState(ACTION_TYPES[0].value);
  const [formAutoExecute, setFormAutoExecute] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-400">로딩 중...</span>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !formName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createAutomation(
        {
          name: formName.trim(),
          insight_type: formInsightType,
          action_type: formActionType,
          auto_execute: formAutoExecute,
        },
        token
      );
      setFormName("");
      setFormInsightType(INSIGHT_TYPES[0].value);
      setFormActionType(ACTION_TYPES[0].value);
      setFormAutoExecute(false);
      setShowForm(false);
      await refreshAutomations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "규칙 생성에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    if (!token) return;
    try {
      await toggleAutomation(id, enabled, token);
      await refreshAutomations();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await deleteAutomation(id, token);
      await Promise.all([refreshAutomations(), refreshLogs()]);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-white">
      <NavBar />
      <div className="p-6 max-w-4xl mx-auto w-full">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/ontology"
              className="text-gray-400 hover:text-white transition text-sm"
            >
              ← Ontology
            </Link>
            <h1 className="text-2xl font-bold">Automations</h1>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded bg-green-700 hover:bg-green-600 text-sm font-medium transition"
          >
            {showForm ? "취소" : "규칙 추가"}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Inline form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-6 bg-gray-900 border border-gray-700 rounded-lg p-5 flex flex-col gap-4"
          >
            <h2 className="text-sm font-semibold text-gray-300">새 자동화 규칙</h2>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">규칙 이름</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="예: 허브 노드 감지 시 알림"
                required
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">인사이트 유형</label>
                <select
                  value={formInsightType}
                  onChange={(e) => setFormInsightType(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
                >
                  {INSIGHT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">액션 유형</label>
                <select
                  value={formActionType}
                  onChange={(e) => setFormActionType(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
                >
                  {ACTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-execute"
                checked={formAutoExecute}
                onChange={(e) => setFormAutoExecute(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-green-500 focus:ring-green-500"
              />
              <label htmlFor="auto-execute" className="text-xs text-gray-400">
                자동 실행 (인사이트 감지 시 즉시 액션 수행)
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !formName.trim()}
                className="px-5 py-2 rounded bg-green-700 hover:bg-green-600 disabled:bg-green-900 disabled:cursor-not-allowed text-sm font-medium transition"
              >
                {submitting ? "생성 중..." : "규칙 생성"}
              </button>
            </div>
          </form>
        )}

        {/* Automation cards */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            자동화 규칙 ({automations.length})
          </h2>
          {autoLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-gray-400">로딩 중...</span>
            </div>
          ) : automations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-gray-500 mb-2">등록된 자동화 규칙이 없습니다.</p>
              <p className="text-gray-600 text-sm">위 &quot;규칙 추가&quot; 버튼으로 첫 번째 규칙을 만들어보세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {automations.map((automation) => (
                <AutomationCard
                  key={automation.id}
                  automation={automation}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>

        {/* Recent logs */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            최근 실행 로그
          </h2>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-gray-400">로딩 중...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-gray-500 text-sm">실행 로그가 없습니다.</p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left text-gray-500 px-4 py-2 font-medium">액션</th>
                    <th className="text-left text-gray-500 px-4 py-2 font-medium">상태</th>
                    <th className="text-left text-gray-500 px-4 py-2 font-medium hidden sm:table-cell">
                      인사이트 ID
                    </th>
                    <th className="text-right text-gray-500 px-4 py-2 font-medium">일시</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 20).map((log) => {
                    const statusConf = LOG_STATUS_CONFIG[log.status] ?? {
                      label: log.status,
                      color: "text-gray-400",
                    };
                    return (
                      <tr key={log.id} className="border-b border-gray-800/50 last:border-0">
                        <td className="px-4 py-2 text-gray-300 truncate max-w-[180px]">
                          {log.action_taken}
                        </td>
                        <td className={`px-4 py-2 font-medium ${statusConf.color}`}>
                          {statusConf.label}
                        </td>
                        <td className="px-4 py-2 text-gray-500 font-mono hidden sm:table-cell">
                          {log.insight_id ? log.insight_id.slice(0, 8) + "…" : "—"}
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-right whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("ko-KR", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
