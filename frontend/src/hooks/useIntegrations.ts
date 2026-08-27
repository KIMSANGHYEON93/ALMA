"use client";

import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { authFetcher, swrDefaults, type AuthKey } from "@/lib/swr";
import { useAuth } from "@/contexts/AuthContext";
import type { Integration, AuthUrlResponse, CalendarEvent } from "@/lib/types";

const LIST_URL = "/api/integrations";

export function useIntegrations() {
  const { token } = useAuth();
  const key: AuthKey | null = token ? [LIST_URL, token] : null;
  const { data, isLoading, mutate } = useSWR<Integration[]>(
    key,
    authFetcher,
    swrDefaults
  );

  const integrations = data ?? [];

  const connectGoogle = async () => {
    if (!token) return;
    const res = await apiClient<AuthUrlResponse>(
      "/api/integrations/google/connect",
      { method: "POST", token }
    );
    // 외부 OAuth 동의 화면으로의 이동이라 하드 내비게이션이 맞다
    window.location.href = res.auth_url;
  };

  const disconnect = async (integrationId: string) => {
    if (!token) return;
    await apiClient<void>(`${LIST_URL}/${integrationId}`, {
      method: "DELETE",
      token,
    });
    await mutate();
  };

  const listEvents = async (period: "today" | "week" = "today") => {
    if (!token) return [];
    return apiClient<CalendarEvent[]>(
      `/api/integrations/google/calendar/events?period=${period}`,
      { token }
    );
  };

  const googleCalendar = integrations.find(
    (i) => i.provider === "google_calendar"
  );

  return {
    integrations,
    googleCalendar,
    loading: isLoading,
    connectGoogle,
    disconnect,
    listEvents,
    refresh: () => mutate(),
  };
}
