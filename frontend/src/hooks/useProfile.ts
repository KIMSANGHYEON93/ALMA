"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { authFetcher, swrDefaults, type AuthKey } from "@/lib/swr";
import { useAuth } from "@/contexts/AuthContext";
import type { UserPreferences } from "@/lib/types";

const URL = "/api/users/me/preferences";

export function useProfile() {
  const { token } = useAuth();
  const [saving, setSaving] = useState(false);

  const key: AuthKey | null = token ? [URL, token] : null;
  const { data, isLoading, mutate } = useSWR<UserPreferences>(
    key,
    authFetcher,
    swrDefaults
  );

  const preferences = data ?? {};

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    if (!token) return;
    setSaving(true);
    try {
      // 낙관적 업데이트 + 실패 시 서버 상태로 롤백 (SWR이 처리)
      await mutate(
        () =>
          apiClient<UserPreferences>(URL, {
            method: "PUT",
            token,
            body: updates,
          }),
        {
          optimisticData: (prev) => ({ ...(prev ?? {}), ...updates }),
          rollbackOnError: true,
          revalidate: false,
        }
      );
    } catch {
      // handled by apiClient / SWR 롤백
    } finally {
      setSaving(false);
    }
  };

  return {
    preferences,
    loading: isLoading,
    saving,
    updatePreferences,
    refresh: () => mutate(),
  };
}
