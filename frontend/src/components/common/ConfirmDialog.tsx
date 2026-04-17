"use client";

import Modal from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * window.confirm() 대체용 접근성 있는 확인 다이얼로그.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBtnClass =
    variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "bg-sky-600 text-white hover:bg-sky-700";

  return (
    <Modal open={open} onClose={onCancel} ariaLabel={title} maxWidth="max-w-sm">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 whitespace-pre-line">
          {message}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${confirmBtnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
