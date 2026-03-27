"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

export function usePushNotification() {
  const { token } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported("serviceWorker" in navigator && "PushManager" in window);
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    });
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!token || !isSupported) return;
    try {
      // Service Worker 등록
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // VAPID key 가져오기
      const { publicKey } = await apiClient<{ publicKey: string }>(
        "/api/notifications/vapid-key",
        { token }
      );
      if (!publicKey) return;

      // Push 구독
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      // 서버에 구독 등록
      await apiClient("/api/notifications/subscribe", {
        method: "POST",
        token,
        body: { subscription: subscription.toJSON() },
      });

      setIsSubscribed(true);
    } catch (err) {
      console.error("Push subscribe failed:", err);
    }
  }, [token, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!token || !isSupported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiClient("/api/notifications/unsubscribe", {
          method: "POST",
          token,
          body: { endpoint: sub.endpoint },
        });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    }
  }, [token, isSupported]);

  const testNotification = useCallback(async () => {
    if (!token) return;
    await apiClient("/api/notifications/test", { method: "POST", token });
  }, [token]);

  return {
    isSupported,
    isSubscribed,
    subscribe,
    unsubscribe,
    testNotification,
  };
}
