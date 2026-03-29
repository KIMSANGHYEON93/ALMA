"use client";

import { useState } from "react";
import Link from "next/link";
import NavBar from "@/components/common/NavBar";
import { useAuth } from "@/contexts/AuthContext";
import {
  scanDirectory,
  processFiles,
  importDB,
  useImportSources,
  deleteImportSource,
} from "@/hooks/useOntologyImport";
import type { ScanFileItem } from "@/lib/types";

type Tab = "files" | "database";

interface Toast {
  type: "success" | "error";
  message: string;
}

function StatusBadge({ status }: { status: ScanFileItem["status"] }) {
  const styles = {
    new: "bg-green-900 text-green-300 border border-green-700",
    modified: "bg-yellow-900 text-yellow-300 border border-yellow-700",
    unchanged: "bg-gray-800 text-gray-400 border border-gray-700",
  };
  const labels = {
    new: "신규",
    modified: "변경됨",
    unchanged: "변경 없음",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function OntologyImportPage() {
  const { isLoading, token } = useAuth();
  const { sources, loading: sourcesLoading, refresh: refreshSources } = useImportSources();

  const [activeTab, setActiveTab] = useState<Tab>("files");

  // Files tab state
  const [directory, setDirectory] = useState("docs/");
  const [pattern, setPattern] = useState("**/*.md");
  const [scanning, setScanning] = useState(false);
  const [scanFiles, setScanFiles] = useState<ScanFileItem[]>([]);
  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  // DB tab state
  const [dbImporting, setDbImporting] = useState<Record<string, boolean>>({});

  // Toast
  const [toast, setToast] = useState<Toast | null>(null);

  function showToast(type: Toast["type"], message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  if (isLoading || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <span className="text-gray-400">로딩 중...</span>
      </div>
    );
  }

  const validToken: string = token;

  // ─── Files tab handlers ───

  async function handleScan() {
    setScanning(true);
    setScanFiles([]);
    setCheckedPaths(new Set());
    setImportSuccess(false);
    try {
      const result = await scanDirectory(directory, pattern, validToken);
      setScanFiles(result.files);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "스캔 실패");
    } finally {
      setScanning(false);
    }
  }

  function handleSelectAllNewModified() {
    const autoCheck = new Set<string>();
    for (const f of scanFiles) {
      if (f.status === "new" || f.status === "modified") {
        autoCheck.add(f.path);
      }
    }
    setCheckedPaths(autoCheck);
  }

  function toggleCheck(path: string) {
    setCheckedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function toggleAll() {
    if (checkedPaths.size === scanFiles.length) {
      setCheckedPaths(new Set());
    } else {
      setCheckedPaths(new Set(scanFiles.map((f) => f.path)));
    }
  }

  async function handleImportFiles() {
    if (checkedPaths.size === 0) {
      showToast("error", "가져올 파일을 선택하세요.");
      return;
    }
    setImporting(true);
    try {
      const result = await processFiles(directory, Array.from(checkedPaths), validToken);
      showToast(
        "success",
        `처리 완료: ${result.processed}개 파일, 드래프트 ${result.draft_count}개 생성${result.errors.length > 0 ? ` (오류 ${result.errors.length}건)` : ""}`
      );
      setImportSuccess(true);
      refreshSources();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "임포트 실패");
    } finally {
      setImporting(false);
    }
  }

  // ─── DB tab handlers ───

  async function handleImportDB(sourceType: string) {
    setDbImporting((prev) => ({ ...prev, [sourceType]: true }));
    try {
      const result = await importDB([sourceType], validToken);
      showToast(
        "success",
        `${sourceType} 임포트 완료: ${result.processed}개 처리, 드래프트 ${result.draft_count}개 생성`
      );
      refreshSources();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "DB 임포트 실패");
    } finally {
      setDbImporting((prev) => ({ ...prev, [sourceType]: false }));
    }
  }

  // ─── History handler ───

  async function handleDeleteSource(id: string) {
    try {
      await deleteImportSource(id, validToken);
      showToast("success", "임포트 소스가 삭제되었습니다.");
      refreshSources();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "삭제 실패");
    }
  }

  const dbSources = [
    { key: "goals", label: "Goals", description: "목표 및 마일스톤 데이터" },
    { key: "habits", label: "Habits", description: "습관 추적 및 로그 데이터" },
    { key: "memories", label: "Memories", description: "대화 메모리 및 지식 데이터" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-white">
      <NavBar />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === "success"
              ? "bg-green-800 text-green-100 border border-green-600"
              : "bg-red-900 text-red-100 border border-red-700"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="p-6 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Ontology Import</h1>
            <p className="text-gray-400 text-sm mt-1">파일 또는 DB에서 온톨로지 노드를 가져옵니다</p>
          </div>
          <Link
            href="/ontology"
            className="px-4 py-2 rounded bg-gray-800 text-sm font-medium hover:bg-gray-700 transition"
          >
            ← Ontology
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-800 pb-0">
          <button
            onClick={() => setActiveTab("files")}
            className={`px-5 py-2.5 text-sm font-medium rounded-t border-b-2 transition -mb-px ${
              activeTab === "files"
                ? "border-blue-500 text-blue-400 bg-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-200 bg-transparent"
            }`}
          >
            Files
          </button>
          <button
            onClick={() => setActiveTab("database")}
            className={`px-5 py-2.5 text-sm font-medium rounded-t border-b-2 transition -mb-px ${
              activeTab === "database"
                ? "border-blue-500 text-blue-400 bg-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-200 bg-transparent"
            }`}
          >
            Database
          </button>
        </div>

        {/* ─── Files Tab ─── */}
        {activeTab === "files" && (
          <div className="space-y-4">
            {/* Scan controls */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
              <h2 className="text-base font-semibold text-gray-200">디렉토리 스캔</h2>
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-48">
                  <label className="block text-xs text-gray-400 mb-1">디렉토리</label>
                  <input
                    type="text"
                    value={directory}
                    onChange={(e) => setDirectory(e.target.value)}
                    placeholder="docs/"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex-1 min-w-36">
                  <label className="block text-xs text-gray-400 mb-1">파일 패턴</label>
                  <input
                    type="text"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="**/*.md"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleScan}
                    disabled={scanning}
                    className="px-5 py-2 rounded-lg bg-blue-600 text-sm font-medium hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {scanning ? "스캔 중..." : "스캔"}
                  </button>
                </div>
              </div>
            </div>

            {/* Scan results */}
            {scanFiles.length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
                  <span className="text-sm text-gray-300">
                    {scanFiles.length}개 파일 발견 &nbsp;
                    <span className="text-green-400">{scanFiles.filter((f) => f.status === "new").length} 신규</span>
                    {" · "}
                    <span className="text-yellow-400">{scanFiles.filter((f) => f.status === "modified").length} 변경</span>
                    {" · "}
                    <span className="text-gray-500">{scanFiles.filter((f) => f.status === "unchanged").length} 변경 없음</span>
                  </span>
                  <button
                    onClick={handleSelectAllNewModified}
                    className="px-3 py-1.5 rounded bg-gray-700 text-xs font-medium hover:bg-gray-600 transition"
                  >
                    신규/변경 전체 선택
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-800/50 text-xs text-gray-400 uppercase tracking-wide">
                        <th className="px-4 py-2 text-left w-8">
                          <input
                            type="checkbox"
                            checked={checkedPaths.size === scanFiles.length && scanFiles.length > 0}
                            onChange={toggleAll}
                            className="accent-blue-500"
                          />
                        </th>
                        <th className="px-4 py-2 text-left">파일 경로</th>
                        <th className="px-4 py-2 text-left">상태</th>
                        <th className="px-4 py-2 text-right">크기</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanFiles.map((file) => (
                        <tr
                          key={file.path}
                          className="border-t border-gray-800 hover:bg-gray-800/30 transition"
                        >
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={checkedPaths.has(file.path)}
                              onChange={() => toggleCheck(file.path)}
                              className="accent-blue-500"
                            />
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-gray-200 max-w-xs truncate">
                            {file.path}
                          </td>
                          <td className="px-4 py-2">
                            <StatusBadge status={file.status} />
                          </td>
                          <td className="px-4 py-2 text-right text-gray-400 tabular-nums">
                            {formatBytes(file.size)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800 bg-gray-900">
                  <span className="text-xs text-gray-500">
                    {checkedPaths.size}개 선택됨
                  </span>
                  <div className="flex items-center gap-3">
                    {importSuccess && (
                      <Link
                        href="/ontology"
                        className="px-4 py-2 rounded-lg bg-purple-700 text-sm font-medium hover:bg-purple-600 transition"
                      >
                        드래프트 검토 →
                      </Link>
                    )}
                    <button
                      onClick={handleImportFiles}
                      disabled={importing || checkedPaths.size === 0}
                      className="px-5 py-2 rounded-lg bg-green-700 text-sm font-medium hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {importing ? "임포트 중..." : "임포트"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {scanFiles.length === 0 && !scanning && (
              <div className="text-center py-12 text-gray-500 text-sm">
                디렉토리를 입력하고 스캔 버튼을 클릭하세요.
              </div>
            )}
          </div>
        )}

        {/* ─── Database Tab ─── */}
        {activeTab === "database" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {dbSources.map((src) => (
              <div
                key={src.key}
                className="bg-gray-900 rounded-xl p-5 border border-gray-800 flex flex-col gap-4"
              >
                <div>
                  <h3 className="text-base font-semibold text-gray-100">{src.label}</h3>
                  <p className="text-xs text-gray-400 mt-1">{src.description}</p>
                </div>
                <button
                  onClick={() => handleImportDB(src.key)}
                  disabled={!!dbImporting[src.key]}
                  className="mt-auto px-4 py-2 rounded-lg bg-blue-700 text-sm font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {dbImporting[src.key] ? "가져오는 중..." : "DB에서 가져오기"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ─── Import History ─── */}
        <div className="mt-10">
          <h2 className="text-base font-semibold text-gray-200 mb-3">임포트 기록</h2>
          {sourcesLoading ? (
            <div className="text-gray-500 text-sm py-4">로딩 중...</div>
          ) : sources.length === 0 ? (
            <div className="text-gray-500 text-sm py-4">임포트 기록이 없습니다.</div>
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/50 text-xs text-gray-400 uppercase tracking-wide">
                      <th className="px-4 py-2 text-left">소스 타입</th>
                      <th className="px-4 py-2 text-left">경로</th>
                      <th className="px-4 py-2 text-right">노드</th>
                      <th className="px-4 py-2 text-left">상태</th>
                      <th className="px-4 py-2 text-left">마지막 임포트</th>
                      <th className="px-4 py-2 text-center w-16">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((src) => (
                      <tr
                        key={src.id}
                        className="border-t border-gray-800 hover:bg-gray-800/30 transition"
                      >
                        <td className="px-4 py-2">
                          <span className="px-2 py-0.5 rounded bg-blue-900 text-blue-300 border border-blue-700 text-xs font-medium">
                            {src.source_type}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-300 max-w-xs truncate">
                          {src.source_path || "—"}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-gray-300">
                          {src.node_count}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              src.status === "completed"
                                ? "bg-green-900 text-green-300 border border-green-700"
                                : src.status === "failed"
                                ? "bg-red-900 text-red-300 border border-red-700"
                                : "bg-gray-800 text-gray-400 border border-gray-700"
                            }`}
                          >
                            {src.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-400">
                          {formatDate(src.last_imported_at)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleDeleteSource(src.id)}
                            className="px-2 py-1 rounded bg-red-900/50 text-red-400 text-xs hover:bg-red-800 transition border border-red-800"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
