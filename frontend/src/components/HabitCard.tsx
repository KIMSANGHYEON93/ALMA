"use client";

import { useState } from "react";
import type { TodayHabitItem } from "@/lib/types";

interface Props {
  item: TodayHabitItem;
  onCheckin: (completed: boolean, value?: number, note?: string) => Promise<void>;
  onEdit: () => void;
  onPause: () => void;
  onDelete: () => void;
}

export default function HabitCard({ item, onCheckin, onEdit, onPause, onDelete }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState(item.note || "");
  const [valueInput, setValueInput] = useState(item.value?.toString() || "");
  const [loading, setLoading] = useState(false);

  const hasTarget = item.target_value !== null;

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (hasTarget) {
        const val = parseFloat(valueInput) || 0;
        await onCheckin(val >= (item.target_value || 0), val, noteText || undefined);
      } else {
        await onCheckin(!item.completed, undefined, noteText || undefined);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleValueSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const val = parseFloat(valueInput) || 0;
      await onCheckin(val >= (item.target_value || 0), val, noteText || undefined);
    } finally {
      setLoading(false);
    }
  };

  const pct = hasTarget && item.target_value
    ? Math.min(100, Math.round(((item.value || 0) / item.target_value) * 100))
    : 0;

  return (
    <div
      className={`p-4 rounded-xl border transition ${
        item.completed
          ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
          : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
      } ${!item.scheduled_today ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Checkbox / Toggle */}
          {!hasTarget && (
            <button
              onClick={handleToggle}
              disabled={loading}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                item.completed
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-gray-300 dark:border-gray-600 hover:border-emerald-400"
              }`}
            >
              {item.completed && (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          )}
          <div>
            <span className={`font-medium ${item.completed ? "text-emerald-700 dark:text-emerald-400" : "text-gray-900 dark:text-gray-100"}`}>
              {item.title}
            </span>
            {item.streak > 0 && (
              <span className="ml-2 text-xs text-orange-500 font-medium">
                {item.streak}{item.frequency_type === "times_per_week" ? "주" : "일"}
              </span>
            )}
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg z-10 py-1 min-w-[100px]">
              <button onClick={() => { onEdit(); setShowMenu(false); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700">수정</button>
              <button onClick={() => { onPause(); setShowMenu(false); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700">일시정지</button>
              <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700">삭제</button>
            </div>
          )}
        </div>
      </div>

      {/* Value input for target habits */}
      {hasTarget && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
              onBlur={handleValueSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleValueSubmit()}
              className="w-20 px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700"
              placeholder="0"
            />
            <span className="text-sm text-gray-500">
              / {item.target_value} {item.target_unit}
            </span>
          </div>
          <div className="mt-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Note toggle */}
      <button
        onClick={() => setShowNote(!showNote)}
        className="mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        {showNote ? "메모 접기" : "메모"}
      </button>
      {showNote && (
        <input
          type="text"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onBlur={() => item.checked_in && onCheckin(item.completed, item.value ?? undefined, noteText || undefined)}
          placeholder="짧은 메모..."
          className="mt-1 w-full px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700"
        />
      )}
    </div>
  );
}
