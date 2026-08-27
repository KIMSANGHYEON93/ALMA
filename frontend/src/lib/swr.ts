"use client";

import { apiClient } from "@/lib/api";

/**
 * SWR 키는 `[url, token]` 튜플로 둔다.
 * - 토큰이 키에 포함되므로 재로그인 시 캐시가 자연스럽게 분리된다.
 * - 토큰이 없으면 훅에서 키를 `null`로 넘겨 요청 자체를 막는다.
 */
export type AuthKey = [url: string, token: string];

export const authFetcher = <T>([url, token]: AuthKey): Promise<T> =>
  apiClient<T>(url, { token });

/**
 * 마이그레이션 이전 동작(마운트 시 1회 fetch)에 최대한 맞춘 기본값.
 * 포커스 복귀마다 재검증하면 LLM 호출이 섞인 엔드포인트에서 비용이 커질 수 있어 꺼 둔다.
 * 화면별로 최신성이 더 중요하면 해당 훅에서 revalidateOnFocus를 켤 것.
 */
export const swrDefaults = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 5_000,
} as const;

/**
 * SWR이 던지는 error(unknown)를 기존 훅들이 노출하던 `string | null` 형태로 되돌린다.
 * 소비 컴포넌트의 시그니처를 그대로 유지하기 위한 어댑터.
 */
export const errMessage = (error: unknown, fallback: string): string | null => {
  if (!error) return null;
  return error instanceof Error ? error.message : fallback;
};
