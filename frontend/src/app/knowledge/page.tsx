"use client";

import { useState } from "react";
import NavBar from "@/components/common/NavBar";
import KnowledgeCard from "@/components/KnowledgeCard";
import AddKnowledgeModal from "@/components/AddKnowledgeModal";
import { useAuth } from "@/contexts/AuthContext";
import { useKnowledge } from "@/hooks/useKnowledge";

export default function KnowledgePage() {
  const { isLoading: authLoading } = useAuth();
  const { documents, loading, addDocument, addFromUrl, addFile, deleteDocument } = useKnowledge();
  const [showAdd, setShowAdd] = useState(false);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-400">로딩 중...</span>
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
            <span className="text-sm text-gray-400">{documents.length}개 문서</span>
          </div>

          <div className="space-y-3">
            {documents.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg mb-2">아직 등록된 지식이 없습니다</p>
                <p className="text-sm">+ 버튼으로 텍스트나 URL을 추가하면 채팅에서 자동으로 활용됩니다</p>
              </div>
            ) : (
              documents.map((doc) => (
                <KnowledgeCard
                  key={doc.id}
                  doc={doc}
                  onDelete={() => {
                    if (confirm("이 문서를 삭제하시겠습니까?")) {
                      deleteDocument(doc.id);
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>

        <button
          onClick={() => setShowAdd(true)}
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
      </div>
    </div>
  );
}
