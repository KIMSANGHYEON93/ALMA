"use client";

import type { OntologyNode } from "@/lib/types";
import { verifyObject, archiveObject } from "@/hooks/useOntology";
import { useAuth } from "@/contexts/AuthContext";

export default function DraftReview({ drafts, onAction }: { drafts: OntologyNode[]; onAction: () => void }) {
  const { token } = useAuth();

  if (drafts.length === 0) return <div className="text-gray-400">No drafts to review.</div>;

  const handleVerify = async (id: string) => {
    if (!token) return;
    await verifyObject(id, token);
    onAction();
  };

  const handleReject = async (id: string) => {
    if (!token) return;
    await archiveObject(id, token);
    onAction();
  };

  return (
    <div className="space-y-2">
      {drafts.map((draft) => (
        <div key={draft.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <span className="font-medium">{draft.name}</span>
            <span className="text-gray-400 text-sm ml-2">
              ({draft.type_name} / {(draft.confidence * 100).toFixed(0)}%)
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleVerify(draft.id)}
              className="px-3 py-1 bg-green-700 rounded text-sm hover:bg-green-600"
            >
              Verify
            </button>
            <button
              onClick={() => handleReject(draft.id)}
              className="px-3 py-1 bg-red-600 rounded text-sm hover:bg-red-500"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
