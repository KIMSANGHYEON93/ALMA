"use client";

import React, { useEffect, useRef, useState } from "react";
import type { TodayHabitItem } from "@/lib/types";

interface Props {
  item: TodayHabitItem;
  onCheckin: (habitId: string, completed: boolean, value?: number, note?: string) => Promise<void>;
  onEdit: (habitId: string) => void;
  onPause: (habitId: string) => void;
  onDelete: (habitId: string) => void;
}

function HabitCard({ item, onCheckin, onEdit, onPause, onDelete }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState(item.note || "");
  const [valueInput, setValueInput] = useState(item.value?.toString() || "");
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close menu on outside click / ESC / blur
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowMenu(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showMenu]);

  const hasTarget = item.target_value !== null;

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (hasTarget) {
        const val = parseFloat(valueInput) || 0;
        await onCheckin(item.id, val >= (item.target_value || 0), val, noteText || undefined);
      } else {
        await onCheckin(item.id, !item.completed, undefined, noteText || undefined);
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
      await onCheckin(item.id, val >= (item.target_value || 0), val, noteText || undefined);
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
          : item.scheduled_today && !item.checked_in
            ? "bg-white dark:bg-gray-900 border-l-4 border-l-orange-400 border-gray-200 dark:border-gray-800"
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
              aria-label={`${item.title} 완료 토글`}
              aria-pressed={item.completed}
              className={`relative w-6 h-6 rounded-full border-2 flex items-center justify-center transition before:absolute before:inset-[-10px] before:content-[''] ${
                item.completed
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-gray-300 dark:border-gray-600 hover:border-emerald-400"
              }`}
            >
              {item.completed && (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
                <svg className="w-3.5 h-3.5 inline -mt-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 23a7.5 7.5 0 01-5.138-12.963C8.204 8.774 11.5 6.5 11 1.5c6 4 9 8 3 14 1 0 2.5-1.5 3-3.5.5 2.5-.5 5-2 7A7.5 7.5 0 0112 23z" /></svg>
                {" "}{item.streak}{item.frequency_type === "times_per_week" ? "주" : "일"}
              </span>
            )}
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            ref={menuButtonRef}
            onClick={() => setShowMenu(!showMenu)}
            aria-label={`${item.title} 옵션 메뉴`}
            aria-haspopup="menu"
            aria-expanded={showMenu}
            className="p-3.5 -m-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
          {showMenu && (
            <div
              role="menu"
              className="absolute right-0 mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg z-10 py-1 min-w-[120px]"
            >
              <button
                role="menuitem"
                onClick={() => { onEdit(item.id); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                수정
              </button>
              <button
                role="menuitem"
                onClick={() => { onPause(item.id); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                일시정지
              </button>
              <button
                role="menuitem"
                onClick={() => { onDelete(item.id); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                삭제
              </button>
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
            <span className="text-sm text-gray-600 dark:text-gray-400">
              / {item.target_value} {item.target_unit}
            </span>
          </div>
          <div className="mt-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Note toggle */}
      <button
        onClick={() => setShowNote(!showNote)}
        className="mt-2 py-2 px-3 -ml-3 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        {showNote ? "메모 접기" : "메모"}
      </button>
      {showNote && (
        <input
          type="text"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onBlur={() => {
            if (item.checked_in && noteText !== (item.note || "")) {
              onCheckin(item.id, item.completed, item.value ?? undefined, noteText || undefined);
            }
          }}
          placeholder="짧은 메모..."
          className="mt-1 w-full px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700"
        />
      )}
    </div>
  );
}

export default React.memo(HabitCard);
