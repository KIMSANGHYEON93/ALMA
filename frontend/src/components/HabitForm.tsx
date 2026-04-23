"use client";

import { useState } from "react";
import Modal from "./common/Modal";
import type { HabitCreate, FrequencyType } from "@/lib/types";

interface Props {
  onSubmit: (data: HabitCreate) => Promise<void>;
  onClose: () => void;
  initial?: Partial<HabitCreate>;
}

const FREQ_OPTIONS: { value: FrequencyType; label: string }[] = [
  { value: "daily", label: "매일" },
  { value: "specific_days", label: "특정 요일" },
  { value: "times_per_week", label: "주 N회" },
  { value: "every_n_days", label: "N일마다" },
];

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export default function HabitForm({ onSubmit, onClose, initial }: Props) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [freqType, setFreqType] = useState<FrequencyType>(initial?.frequency_type || "daily");
  const [days, setDays] = useState<number[]>((initial?.frequency_value?.days as number[]) || []);
  const [times, setTimes] = useState((initial?.frequency_value?.times as number) || 3);
  const [intervalDays, setIntervalDays] = useState((initial?.frequency_value?.interval as number) || 2);
  const [targetValue, setTargetValue] = useState(initial?.target_value?.toString() || "");
  const [targetUnit, setTargetUnit] = useState(initial?.target_unit || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const handleSubmit = async () => {
    if (!title.trim() || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      let frequency_value: Record<string, unknown> = {};
      if (freqType === "specific_days") frequency_value = { days };
      if (freqType === "times_per_week") frequency_value = { times };
      if (freqType === "every_n_days") frequency_value = { interval: intervalDays };

      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        frequency_type: freqType,
        frequency_value,
        target_value: targetValue ? parseFloat(targetValue) : undefined,
        target_unit: targetUnit.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "습관 저장에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} ariaLabel={initial ? "습관 수정" : "새 습관"} maxWidth="max-w-md">
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {initial ? "습관 수정" : "새 습관"}
        </h2>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="습관 이름"
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          autoFocus
        />

        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="설명 (선택)"
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
        />

        {/* Frequency type */}
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">반복 주기</label>
          <div className="grid grid-cols-2 gap-2">
            {FREQ_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFreqType(opt.value)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                  freqType === opt.value
                    ? "bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Frequency value */}
        {freqType === "specific_days" && (
          <div className="flex gap-1">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={`w-9 h-9 rounded-full text-sm font-medium transition ${
                  days.includes(i)
                    ? "bg-sky-700 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {freqType === "times_per_week" && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">주</span>
            <input
              type="number"
              min={1}
              max={7}
              value={times}
              onChange={(e) => setTimes(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">회</span>
          </div>
        )}
        {freqType === "every_n_days" && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={intervalDays}
              onChange={(e) => setIntervalDays(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">일마다</span>
          </div>
        )}

        {/* Target value */}
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">목표량 (선택)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="예: 8"
              className="w-24 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700"
            />
            <input
              type="text"
              value={targetUnit}
              onChange={(e) => setTargetUnit(e.target.value)}
              placeholder="단위 (잔, 분...)"
              className="flex-1 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg"
          >
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
            className="px-4 py-2 text-sm bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "저장 중..." : initial ? "수정" : "추가"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
