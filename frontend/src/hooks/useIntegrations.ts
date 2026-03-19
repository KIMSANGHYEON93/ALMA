"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Integration, AuthUrlResponse, CalendarEvent } from "@/lib/types";

export function useIntegrations() {
  const { token } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiClient<Integration[]>("/api/integrations", { token });
      setIntegrations(data);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const connectGoogle = async () => {
    if (!token) return;
    try {
      const data = await apiClient<AuthUrlResponse>("/api/integrations/google/connect", {
        method: "POST",
        token,
      });
      window.location.href = data.auth_url;
    } catch (e) {
      throw e;
    }
  };

  const disconnect = async (integrationId: string) => {
    if (!token) return;
    await apiClient<void>(`/api/integrations/${integrationId}`, {
      method: "DELETE",
      token,
    });
    await fetchIntegrations();
  };

  const listEvents = async (period: "today" | "week" = "today") => {
    if (!token) return [];
    return apiClient<CalendarEvent[]>(
      `/api/integrations/google/calendar/events?period=${period}`,
      { token }
    );
  };

  const googleCalendar = integrations.find((i) => i.provider === "google_calendar");

  return {
    integrations,
    googleCalendar,
    loading,
    connectGoogle,
    disconnect,
    listEvents,
    refresh: fetchIntegrations,
  };
}
