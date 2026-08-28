"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import NavBar from "@/components/common/NavBar";
import { useAuth } from "@/contexts/AuthContext";
import {
  browseDirectory,
  scanDirectory,
  processFiles,
  importDB,
  useImportSources,
  deleteImportSource,
} from "@/hooks/useOntologyImport";
import type { ScanFileItem, BrowseEntry } from "@/lib/types";

type Tab = "files" | "database";
type StatusFilter = "all" | "new" | "modified" | "unchanged";
type SortKey = "path" | "status" | "size";

interface Toast {
  type: "success" | "error";
  message: string;
}

const RECENT_PATHS_KEY = "vivara_import_recent_paths";
const MAX_RECENT = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SortIcon({ col, sortKey, sortAsc }: { col: SortKey; sortKey: SortKey; sortAsc: boolean }) {
  return sortKey === col ? (
    <span className="ml-1 text-sky-400">{sortAsc ? "↑" : "↓"}</span>
  ) : null;
}

function StatusBadge({ status }: { status: ScanFileItem["status"] }) {
  const styles = {
    new: "bg-green-900 text-green-300 border border-green-700",
    modified: "bg-yellow-900 text-yellow-300 border border-yellow-700",
    unchanged: "bg-gray-800 text-gray-400 border border-gray-700",
  };
  const labels = { new: "신규", modified: "변경됨", unchanged: "변경 없음" };
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
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function getRecentPaths(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_PATHS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecentPath(path: string) {
  const recent = getRecentPaths().filter((p) => p !== path);
  recent.unshift(path);
  localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

// ---------------------------------------------------------------------------
// FolderBrowser Modal
// ---------------------------------------------------------------------------

function FolderBrowserModal({
  open,
  token,
  onSelect,
  onClose,
}: {
  open: boolean;
  token: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const browse = useCallback(
    async (path: string) => {
      setLoading(true);
      setError("");
      setSearch("");
      try {
        const res = await browseDirectory(path, token);
        setCurrentPath(res.current);
        setParentPath(res.parent);
        setEntries(res.entries);
      } catch (e) {
        setError(e instanceof Error ? e.message : "디렉토리 조회 실패");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (open) browse("");
  }, [open, browse]);

  const filtered = useMemo(
    () =>
      search
        ? entries.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
        : entries,
    [entries, search]
  );

  const dirs = filtered.filter((e) => e.is_dir);
  const files = filtered.filter((e) => !e.is_dir);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="폴더 브라우저"
    >
      <div className="w-full max-w-2xl mx-4 bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-5 h-5 text-sky-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h2 className="text-base font-semibold text-gray-100 truncate">폴더 선택</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-gray-400 hover:text-gray-200 transition text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-1 text-xs text-gray-400 overflow-x-auto">
          <button
            onClick={() => browse("")}
            className="hover:text-sky-400 transition shrink-0 font-medium"
          >
            /root
          </button>
          {currentPath &&
            currentPath.split(/[/\\]/).map((seg, i, arr) => {
              const partial = arr.slice(0, i + 1).join("/");
              return (
                <span key={partial} className="flex items-center gap-1 shrink-0">
                  <span className="text-gray-600">/</span>
                  <button
                    onClick={() => browse(partial)}
                    className="hover:text-sky-400 transition"
                  >
                    {seg}
                  </button>
                </span>
              );
            })}
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-gray-800">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="이름으로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="py-12 text-center text-gray-500 text-sm">로딩 중...</div>
          ) : error ? (
            <div className="py-12 text-center text-red-400 text-sm">{error}</div>
          ) : (
            <div className="divide-y divide-gray-800">
              {/* Parent directory */}
              {parentPath !== null && (
                <button
                  onClick={() => browse(parentPath)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-800/50 transition text-left"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                  </svg>
                  <span className="text-sm text-gray-400">..</span>
                </button>
              )}

              {/* Directories */}
              {dirs.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => browse(entry.path)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-800/50 transition text-left group"
                >
                  <svg className="w-4 h-4 text-sky-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="text-sm text-gray-200 group-hover:text-sky-300 transition truncate">
                    {entry.name}
                  </span>
                </button>
              ))}

              {/* Files */}
              {files.map((entry) => (
                <div
                  key={entry.path}
                  className="px-4 py-2.5 flex items-center gap-3 text-left"
                >
                  <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm text-gray-500 truncate flex-1">{entry.name}</span>
                  <span className="text-xs text-gray-600 tabular-nums">{formatBytes(entry.size)}</span>
                </div>
              ))}

              {dirs.length === 0 && files.length === 0 && (
                <div className="py-8 text-center text-gray-600 text-sm">비어있는 디렉토리</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex items-center justify-between">
          <div className="text-xs text-gray-500 truncate mr-4">
            {currentPath || "/"}
            <span className="text-gray-600 ml-2">({dirs.length} 폴더, {files.length} 파일)</span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 transition"
            >
              취소
            </button>
            <button
              onClick={() => {
                onSelect(currentPath || "");
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-sky-700 text-sm font-medium text-white hover:bg-sky-800 transition"
            >
              이 폴더 선택
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

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

  // Browser modal
  const [browserOpen, setBrowserOpen] = useState(false);
  const [recentPaths, setRecentPaths] = useState<string[]>([]);

  // Search & filter
  const [fileSearch, setFileSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("path");
  const [sortAsc, setSortAsc] = useState(true);

  // DB tab state
  const [dbImporting, setDbImporting] = useState<Record<string, boolean>>({});

  // Toast
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    setRecentPaths(getRecentPaths());
  }, []);

  function showToast(type: Toast["type"], message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  // Filtered & sorted scan files
  const filteredFiles = useMemo(() => {
    let result = scanFiles;

    // Search
    if (fileSearch) {
      const q = fileSearch.toLowerCase();
      result = result.filter((f) => f.path.toLowerCase().includes(q));
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((f) => f.status === statusFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "path") cmp = a.path.localeCompare(b.path);
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      else if (sortKey === "size") cmp = a.size - b.size;
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [scanFiles, fileSearch, statusFilter, sortKey, sortAsc]);

  if (isLoading || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <span className="text-gray-400">로딩 중...</span>
      </div>
    );
  }

  const validToken: string = token;

  // ─── Handlers ───

  async function handleScan() {
    setScanning(true);
    setScanFiles([]);
    setCheckedPaths(new Set());
    setImportSuccess(false);
    setFileSearch("");
    setStatusFilter("all");
    try {
      const result = await scanDirectory(directory, pattern, validToken);
      setScanFiles(result.files);
      saveRecentPath(directory);
      setRecentPaths(getRecentPaths());
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "스캔 실패");
    } finally {
      setScanning(false);
    }
  }

  function handleSelectAllNewModified() {
    const autoCheck = new Set<string>();
    for (const f of filteredFiles) {
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
    const visiblePaths = filteredFiles.map((f) => f.path);
    const allChecked = visiblePaths.every((p) => checkedPaths.has(p));
    if (allChecked) {
      setCheckedPaths((prev) => {
        const next = new Set(prev);
        visiblePaths.forEach((p) => next.delete(p));
        return next;
      });
    } else {
      setCheckedPaths((prev) => {
        const next = new Set(prev);
        visiblePaths.forEach((p) => next.add(p));
        return next;
      });
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
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

  async function handleDeleteSource(id: string) {
    try {
      await deleteImportSource(id, validToken);
      showToast("success", "임포트 소스가 삭제되었습니다.");
      refreshSources();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "삭제 실패");
    }
  }

  function handleBrowseSelect(path: string) {
    setDirectory(path ? path + "/" : "");
  }

  const dbSources = [
    { key: "goals", label: "목표", description: "목표 및 마일스톤 데이터" },
    { key: "habits", label: "습관", description: "습관 추적 및 로그 데이터" },
    { key: "memories", label: "기억", description: "대화 메모리 및 지식 데이터" },
  ];

  const statusCounts = {
    new: scanFiles.filter((f) => f.status === "new").length,
    modified: scanFiles.filter((f) => f.status === "modified").length,
    unchanged: scanFiles.filter((f) => f.status === "unchanged").length,
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-white">
      <NavBar />

      {/* Toast */}
      {toast && (
        <div
          role="alert"
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium transition-colors duration-300 ${
            toast.type === "success"
              ? "bg-green-800 text-green-100 border border-green-600"
              : "bg-red-900 text-red-100 border border-red-700"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Folder Browser Modal */}
      <FolderBrowserModal
        open={browserOpen}
        token={validToken}
        onSelect={handleBrowseSelect}
        onClose={() => setBrowserOpen(false)}
      />

      <div className="p-6 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">온톨로지 임포트</h1>
            <p className="text-gray-400 text-sm mt-1">파일 또는 DB에서 온톨로지 노드를 가져옵니다</p>
          </div>
          <Link
            href="/ontology"
            className="px-4 py-2 rounded bg-gray-800 text-sm font-medium hover:bg-gray-700 transition"
          >
            ← 온톨로지
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-800 pb-0">
          <button
            onClick={() => setActiveTab("files")}
            className={`px-5 py-2.5 text-sm font-medium rounded-t border-b-2 transition -mb-px ${
              activeTab === "files"
                ? "border-sky-500 text-sky-400 bg-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-200 bg-transparent"
            }`}
          >
            파일
          </button>
          <button
            onClick={() => setActiveTab("database")}
            className={`px-5 py-2.5 text-sm font-medium rounded-t border-b-2 transition -mb-px ${
              activeTab === "database"
                ? "border-sky-500 text-sky-400 bg-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-200 bg-transparent"
            }`}
          >
            데이터베이스
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
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={directory}
                      onChange={(e) => setDirectory(e.target.value)}
                      placeholder="docs/"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      onClick={() => setBrowserOpen(true)}
                      title="폴더 찾아보기"
                      aria-label="폴더 찾아보기"
                      className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition border border-gray-600"
                    >
                      <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </button>
                  </div>
                  {/* Recent paths */}
                  {recentPaths.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <span className="text-xs text-gray-600">최근:</span>
                      {recentPaths.map((p) => (
                        <button
                          key={p}
                          onClick={() => setDirectory(p)}
                          className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 hover:text-sky-400 hover:bg-gray-700 transition border border-gray-700"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-36">
                  <label className="block text-xs text-gray-400 mb-1">파일 패턴</label>
                  <input
                    type="text"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="**/*.md"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleScan}
                    disabled={scanning}
                    className="px-5 py-2 rounded-lg bg-sky-700 text-sm font-medium hover:bg-sky-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {scanning ? (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        스캔 중...
                      </span>
                    ) : (
                      "스캔"
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Scan results */}
            {scanFiles.length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                {/* Results header with search & filter */}
                <div className="px-5 py-3 border-b border-gray-800 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-sm text-gray-300">
                      {scanFiles.length}개 파일 발견
                      {filteredFiles.length !== scanFiles.length && (
                        <span className="text-gray-500"> (필터: {filteredFiles.length}개)</span>
                      )}
                    </span>
                    <button
                      onClick={handleSelectAllNewModified}
                      className="px-3 py-1.5 rounded bg-gray-700 text-xs font-medium hover:bg-gray-600 transition"
                    >
                      신규/변경 전체 선택
                    </button>
                  </div>

                  {/* Search + Status filters */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-48">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="파일명 검색..."
                        value={fileSearch}
                        onChange={(e) => setFileSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div className="flex gap-1">
                      {(
                        [
                          { key: "all", label: "전체", count: scanFiles.length },
                          { key: "new", label: "신규", count: statusCounts.new },
                          { key: "modified", label: "변경", count: statusCounts.modified },
                          { key: "unchanged", label: "변경없음", count: statusCounts.unchanged },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.key}
                          onClick={() => setStatusFilter(f.key)}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                            statusFilter === f.key
                              ? "bg-sky-700 text-white"
                              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                          }`}
                        >
                          {f.label}
                          <span className="ml-1 opacity-70">{f.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-800/50 text-xs text-gray-400 uppercase tracking-wide">
                        <th className="px-4 py-2 text-left w-8">
                          <input
                            type="checkbox"
                            checked={
                              filteredFiles.length > 0 &&
                              filteredFiles.every((f) => checkedPaths.has(f.path))
                            }
                            onChange={toggleAll}
                            className="accent-sky-500"
                          />
                        </th>
                        <th className="px-4 py-2 text-left">
                          <button onClick={() => handleSort("path")} className="hover:text-sky-400 transition">
                            파일 경로<SortIcon col="path" sortKey={sortKey} sortAsc={sortAsc} />
                          </button>
                        </th>
                        <th className="px-4 py-2 text-left">
                          <button onClick={() => handleSort("status")} className="hover:text-sky-400 transition">
                            상태<SortIcon col="status" sortKey={sortKey} sortAsc={sortAsc} />
                          </button>
                        </th>
                        <th className="px-4 py-2 text-right">
                          <button onClick={() => handleSort("size")} className="hover:text-sky-400 transition">
                            크기<SortIcon col="size" sortKey={sortKey} sortAsc={sortAsc} />
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFiles.map((file) => (
                        <tr
                          key={file.path}
                          className="border-t border-gray-800 hover:bg-gray-800/30 transition"
                        >
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={checkedPaths.has(file.path)}
                              onChange={() => toggleCheck(file.path)}
                              className="accent-sky-500"
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
                      {filteredFiles.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-600 text-sm">
                            검색 결과가 없습니다
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
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
                <br />
                <button
                  onClick={() => setBrowserOpen(true)}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-sky-400 transition border border-gray-700 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  폴더 찾아보기
                </button>
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
                  className="mt-auto px-4 py-2 rounded-lg bg-sky-700 text-sm font-medium hover:bg-sky-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                          <span className="px-2 py-0.5 rounded bg-sky-900 text-sky-300 border border-sky-700 text-xs font-medium">
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
