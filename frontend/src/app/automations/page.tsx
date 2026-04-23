"use client";

import { useState } from "react";
import NavBar from "@/components/common/NavBar";
import Spinner from "@/components/common/Spinner";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import AutomationCard from "@/components/AutomationCard";
import AutomationForm from "@/components/AutomationForm";
import { useAuth } from "@/contexts/AuthContext";
import { useAutomations } from "@/hooks/useAutomations";

export default function AutomationsPage() {
  const { isLoading: authLoading } = useAuth();
  const { rules, loading, error, createRule, deleteRule, toggleRule, refresh } = useAutomations();
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="md" label="자동화 로드 중" />
      </div>
    );
  }

  const activeRules = rules.filter((r) => r.is_active);
  const inactiveRules = rules.filter((r) => !r.is_active);

  return (
    <div className="flex flex-col h-screen">
      <NavBar />
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
        <div className="max-w-2xl mx-auto py-4 px-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">자동화 규칙</h1>
            <span className="text-sm text-gray-700 dark:text-gray-300">{activeRules.length}개 활성</span>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start justify-between gap-2"
            >
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              <button
                onClick={refresh}
                className="text-xs font-medium text-red-700 dark:text-red-300 hover:underline shrink-0"
              >
                다시 시도
              </button>
            </div>
          )}

          <div className="space-y-3">
            {rules.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg mb-2 text-gray-700 dark:text-gray-300">
                  아직 자동화 규칙이 없습니다
                </p>
                <p className="text-sm mb-4 text-gray-700 dark:text-gray-300">
                  반복되는 작업을 이벤트에 따라 자동 실행할 수 있습니다
                </p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 text-sm font-medium"
                >
                  + 첫 규칙 만들기
                </button>
              </div>
            ) : (
              <>
                {activeRules.map((rule) => (
                  <AutomationCard
                    key={rule.id}
                    rule={rule}
                    onToggle={(active) => toggleRule(rule.id, active)}
                    onDelete={() => setConfirmDeleteId(rule.id)}
                  />
                ))}
                {inactiveRules.length > 0 && (
                  <>
                    <p className="text-xs text-gray-600 dark:text-gray-400 pt-2">비활성</p>
                    {inactiveRules.map((rule) => (
                      <AutomationCard
                        key={rule.id}
                        rule={rule}
                        onToggle={(active) => toggleRule(rule.id, active)}
                        onDelete={() => setConfirmDeleteId(rule.id)}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          aria-label="자동화 규칙 추가"
          className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-700 text-white rounded-full shadow-lg hover:bg-emerald-800 transition flex items-center justify-center text-2xl"
        >
          +
        </button>

        {showCreate && (
          <AutomationForm
            onSubmit={createRule}
            onClose={() => setShowCreate(false)}
          />
        )}

        <ConfirmDialog
          open={confirmDeleteId !== null}
          title="규칙 삭제"
          message="이 자동화 규칙을 삭제하시겠습니까? 실행 로그는 유지됩니다."
          confirmLabel="삭제"
          cancelLabel="취소"
          variant="danger"
          onConfirm={() => {
            if (confirmDeleteId) deleteRule(confirmDeleteId);
            setConfirmDeleteId(null);
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      </div>
    </div>
  );
}
