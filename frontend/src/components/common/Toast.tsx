"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = "success", onClose, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      const hideTimer = setTimeout(onClose, 300);
      return () => clearTimeout(hideTimer);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
      className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm text-white transition-[opacity,transform] duration-300 flex items-center gap-3 max-w-sm ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      } ${type === "success" ? "bg-emerald-700" : "bg-red-600"}`}
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 300);
        }}
        aria-label="알림 닫기"
        className="shrink-0 text-white/80 hover:text-white transition text-lg leading-none"
      >
        &times;
      </button>
    </div>
  );
}
