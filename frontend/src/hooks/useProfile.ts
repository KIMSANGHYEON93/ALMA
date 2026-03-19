"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { UserPreferences } from "@/lib/types";

export function useProfile() {
  const { token } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPreferences = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiClient<UserPreferences>("/api/users/me/preferences", { token });
      setPreferences(data);
    } catch {
      // handled by apiClient
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    if (!token) return;
    // 낙관적 업데이트: 클릭 즉시 UI 반영
    setPreferences((prev) => ({ ...prev, ...updates }));
    setSaving(true);
    try {
      const data = await apiClient<UserPreferences>("/api/users/me/preferences", {
        method: "PUT",
        token,
        body: updates,
      });
      setPreferences(data);
    } catch {
      // 실패 시 서버 상태로 롤백
      await fetchPreferences();
    } finally {
      setSaving(false);
    }
  };

  return { preferences, loading, saving, updatePreferences, refresh: fetchPreferences };
}
