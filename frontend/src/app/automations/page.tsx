"use client";

import { useState } from "react";
import NavBar from "@/components/common/NavBar";
import AutomationCard from "@/components/AutomationCard";
import AutomationForm from "@/components/AutomationForm";
import { useAuth } from "@/contexts/AuthContext";
import { useAutomations } from "@/hooks/useAutomations";

export default function AutomationsPage() {
  const { isLoading: authLoading } = useAuth();
  const { rules, loading, createRule, deleteRule, toggleRule } = useAutomations();
  const [showCreate, setShowCreate] = useState(false);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-400">로딩 중...</span>
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
            <span className="text-sm text-gray-400">{activeRules.length}개 활성</span>
          </div>

          <div className="space-y-3">
            {rules.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg mb-2">아직 자동화 규칙이 없습니다</p>
                <p className="text-sm">+ 버튼을 눌러 첫 규칙을 추가하거나, 채팅에서 &quot;자동화 추천해줘&quot;를 요청해보세요</p>
              </div>
            ) : (
              <>
                {activeRules.map((rule) => (
                  <AutomationCard
                    key={rule.id}
                    rule={rule}
                    onToggle={(active) => toggleRule(rule.id, active)}
                    onDelete={() => {
                      if (confirm("이 규칙을 삭제하시겠습니까?")) {
                        deleteRule(rule.id);
                      }
                    }}
                  />
                ))}
                {inactiveRules.length > 0 && (
                  <>
                    <p className="text-xs text-gray-400 pt-2">비활성</p>
                    {inactiveRules.map((rule) => (
                      <AutomationCard
                        key={rule.id}
                        rule={rule}
                        onToggle={(active) => toggleRule(rule.id, active)}
                        onDelete={() => {
                          if (confirm("이 규칙을 삭제하시겠습니까?")) {
                            deleteRule(rule.id);
                          }
                        }}
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
          className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-500 text-white rounded-full shadow-lg hover:bg-emerald-600 transition flex items-center justify-center text-2xl"
        >
          +
        </button>

        {showCreate && (
          <AutomationForm
            onSubmit={createRule}
            onClose={() => setShowCreate(false)}
          />
        )}
      </div>
    </div>
  );
}
