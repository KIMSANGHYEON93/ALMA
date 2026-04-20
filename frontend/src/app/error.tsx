"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * 글로벌 에러 바운더리 — 하위 라우트에서 발생한 렌더/런타임 오류를
 * 흰 화면 대신 복구 UI로 표시한다.
 */
export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // 추후 에러 리포팅 (Sentry 등) 연결 포인트
    console.error("[VIVARA error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div
        role="alert"
        className="max-w-md w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
          문제가 발생했습니다
        </h2>
        <p className="text-sm text-red-700 dark:text-red-400 mb-4 break-words">
          {error.message || "알 수 없는 오류가 발생했습니다."}
          {error.digest && (
            <span className="block mt-1 text-xs text-red-500 dark:text-red-500">
              참조 코드: {error.digest}
            </span>
          )}
        </p>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
          >
            다시 시도
          </button>
          <button
            onClick={() => (window.location.href = "/chat")}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition text-sm font-medium"
          >
            채팅으로
          </button>
        </div>
      </div>
    </div>
  );
}
