"use client";

import { useState } from "react";
import Link from "next/link";
import NavBar from "@/components/common/NavBar";
import Spinner from "@/components/common/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useOntologyStats, useOntologyObjects } from "@/hooks/useOntology";
import OntologyStats from "@/components/ontology/OntologyStats";
import ObjectList from "@/components/ontology/ObjectList";
import DraftReview from "@/components/ontology/DraftReview";

export default function OntologyPage() {
  const { isLoading, token } = useAuth();
  const { stats, loading: statsLoading, error: statsError, refresh: refreshStats } = useOntologyStats();
  const { objects, loading: objLoading, error: objError, refresh: refreshObjects } = useOntologyObjects();
  const [tab, setTab] = useState<"all" | "drafts">("all");

  if (isLoading || !token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="md" label="온톨로지 로드 중" />
      </div>
    );
  }

  const drafts = objects.filter((o) => o.status === "draft");
  const verified = objects.filter((o) => o.status === "verified");

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-white">
      <NavBar />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Ontology</h1>
          <div className="flex gap-2">
            <Link
              href="/ontology/import"
              className="px-4 py-2 rounded bg-orange-600 text-sm font-medium hover:bg-orange-500 transition"
            >
              Import
            </Link>
            <Link
              href="/ontology/insights"
              className="px-4 py-2 rounded bg-purple-600 text-sm font-medium hover:bg-purple-500 transition"
            >
              Insights
            </Link>
            <Link
              href="/ontology/automations"
              className="px-4 py-2 rounded bg-green-600 text-sm font-medium hover:bg-green-500 transition"
            >
              Automations
            </Link>
            <Link
              href="/ontology/graph"
              className="px-4 py-2 rounded bg-sky-600 text-sm font-medium hover:bg-sky-500 transition"
            >
              Graph View
            </Link>
          </div>
        </div>

        {(statsError || objError) && (
          <div
            role="alert"
            className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg flex items-start justify-between gap-2"
          >
            <p className="text-sm text-red-300">{statsError || objError}</p>
            <button
              onClick={() => { refreshStats(); refreshObjects(); }}
              className="text-xs font-medium text-red-200 hover:underline shrink-0"
            >
              다시 시도
            </button>
          </div>
        )}

        {!statsLoading && stats && <OntologyStats stats={stats} />}

        <div className="flex gap-2 mt-6 mb-4">
          <button
            onClick={() => setTab("all")}
            className={`px-4 py-2 rounded ${tab === "all" ? "bg-sky-600" : "bg-gray-800"}`}
          >
            All Nodes ({verified.length})
          </button>
          <button
            onClick={() => setTab("drafts")}
            className={`px-4 py-2 rounded ${tab === "drafts" ? "bg-yellow-600" : "bg-gray-800"}`}
          >
            Drafts ({drafts.length})
          </button>
        </div>

        {tab === "all" ? (
          <ObjectList objects={verified} loading={objLoading} />
        ) : (
          <DraftReview
            drafts={drafts}
            onAction={() => { refreshObjects(); refreshStats(); }}
          />
        )}
      </div>
    </div>
  );
}
