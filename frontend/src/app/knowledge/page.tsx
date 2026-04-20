"use client";

import { useState } from "react";
import NavBar from "@/components/common/NavBar";
import Spinner from "@/components/common/Spinner";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import KnowledgeCard from "@/components/KnowledgeCard";
import AddKnowledgeModal from "@/components/AddKnowledgeModal";
import { useAuth } from "@/contexts/AuthContext";
import { useKnowledge } from "@/hooks/useKnowledge";

export default function KnowledgePage() {
  const { isLoading: authLoading } = useAuth();
  const { documents, loading, error, addDocument, addFromUrl, addFile, deleteDocument, refresh } =
    useKnowledge();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="md" label="지식 베이스 로드 중" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <NavBar />
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
        <div className="max-w-2xl mx-auto py-4 px-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">지식 베이스</h1>
            <span className="text-sm text-gray-500 dark:text-gray-400">{documents.length}개 문서</span>
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
            {documents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg mb-2 text-gray-700 dark:text-gray-300">
                  아직 등록된 지식이 없습니다
                </p>
                <p className="text-sm mb-4 text-gray-500 dark:text-gray-400">
                  텍스트, URL, 파일을 추가하면 채팅에서 자동으로 활용됩니다
                </p>
                <button
                  onClick={() => setShowAdd(true)}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-medium"
                >
                  + 첫 문서 추가하기
                </button>
              </div>
            ) : (
              documents.map((doc) => (
                <KnowledgeCard
                  key={doc.id}
                  doc={doc}
                  onDelete={() => setConfirmDeleteId(doc.id)}
                />
              ))
            )}
          </div>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          aria-label="지식 추가"
          className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-500 text-white rounded-full shadow-lg hover:bg-emerald-600 transition flex items-center justify-center text-2xl"
        >
          +
        </button>

        {showAdd && (
          <AddKnowledgeModal
            onAddText={addDocument}
            onAddUrl={addFromUrl}
            onAddFile={addFile}
            onClose={() => setShowAdd(false)}
          />
        )}

        <ConfirmDialog
          open={confirmDeleteId !== null}
          title="문서 삭제"
          message="이 문서를 삭제하시겠습니까? 청크와 임베딩이 함께 삭제되며, 취소할 수 없습니다."
          confirmLabel="삭제"
          cancelLabel="취소"
          variant="danger"
          onConfirm={() => {
            if (confirmDeleteId) {
              deleteDocument(confirmDeleteId);
            }
            setConfirmDeleteId(null);
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      </div>
    </div>
  );
}
