"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

function getSnapshot(): boolean {
  const stored = localStorage.getItem("alma_theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return stored === "dark" || (!stored && prefersDark);
}

function getServerSnapshot(): boolean {
  return false;
}

// storage 이벤트는 네이티브로는 "다른 탭"에서만 발생하므로, toggle()에서
// 같은 탭의 변경도 반영되도록 동일 이벤트를 직접 dispatch한다 (부수적으로 다른 탭과도 동기화된다).
function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function useDarkMode() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const toggle = useCallback(() => {
    localStorage.setItem("alma_theme", isDark ? "light" : "dark");
    window.dispatchEvent(new StorageEvent("storage"));
  }, [isDark]);

  return { isDark, toggle };
}
