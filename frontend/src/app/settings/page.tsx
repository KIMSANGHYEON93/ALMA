"use client";

import { useState } from "react";
import NavBar from "@/components/common/NavBar";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useIntegrations } from "@/hooks/useIntegrations";
import { usePushNotification } from "@/hooks/usePushNotification";

const models = [
  { value: "claude", label: "Claude (Anthropic)", desc: "고품질 응답" },
  { value: "openai", label: "GPT-4o mini (OpenAI)", desc: "빠른 응답" },
  { value: "gemini", label: "Gemini (Google)", desc: "균형 잡힌 성능" },
];

const languages = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
];

const styles = [
  { value: "concise", label: "간결하게" },
  { value: "detailed", label: "상세하게" },
  { value: "casual", label: "편하게" },
  { value: "professional", label: "전문적으로" },
];

export default function SettingsPage() {
  const { isLoading: authLoading } = useAuth();
  const { preferences, loading: prefLoading, saving, updatePreferences } = useProfile();
  const { googleCalendar, loading: intLoading, connectGoogle, disconnect } = useIntegrations();
  const {
    isSupported: pushSupported,
    isSubscribed: pushSubscribed,
    subscribe: pushSubscribe,
    unsubscribe: pushUnsubscribe,
    testNotification: pushTest,
  } = usePushNotification();
  const [interestInput, setInterestInput] = useState("");
  const [connectError, setConnectError] = useState("");
  const [googleClientId, setGoogleClientId] = useState(preferences.google_client_id as string || "");
  const [googleClientSecret, setGoogleClientSecret] = useState(preferences.google_client_secret as string || "");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");

  if (authLoading || prefLoading || intLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-400">로딩 중...</span>
      </div>
    );
  }

  const handleLanguageChange = (lang: string) => {
    updatePreferences({ language: lang });
  };

  const handleStyleChange = (style: string) => {
    updatePreferences({ response_style: style });
  };

  const handleAddInterest = () => {
    if (!interestInput.trim()) return;
    const current = preferences.interests || [];
    if (current.length >= 10) return;
    updatePreferences({ interests: [...current, interestInput.trim()] });
    setInterestInput("");
  };

  const handleRemoveInterest = (index: number) => {
    const current = preferences.interests || [];
    updatePreferences({ interests: current.filter((_, i) => i !== index) });
  };

  const handleConnect = async () => {
    setConnectError("");
    try {
      await connectGoogle();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "연결 실패";
      setConnectError(msg);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <NavBar />
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
        <div className="max-w-2xl mx-auto p-6 space-y-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">설정</h1>

          {/* Profile Preferences */}
          <section className="bg-white dark:bg-gray-900 rounded-xl p-6 border dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              ALMA 응답 설정
            </h2>

            {/* AI Model */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                AI 모델
              </label>
              <div className="space-y-2">
                {models.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => updatePreferences({ llm_model: m.value })}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                      (preferences.llm_model || "claude") === m.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <span className={`text-sm font-medium ${
                      (preferences.llm_model || "claude") === m.value
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300"
                    }`}>
                      {m.label}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* API Keys */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API 키 (선택 — 입력하면 개인 키 사용)
              </label>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Anthropic (Claude)</label>
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    onBlur={() => anthropicKey !== (preferences.anthropic_api_key || "") && updatePreferences({ anthropic_api_key: anthropicKey })}
                    placeholder={(preferences.anthropic_api_key as string) || "sk-ant-..."}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">OpenAI (GPT)</label>
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    onBlur={() => openaiKey !== (preferences.openai_api_key || "") && updatePreferences({ openai_api_key: openaiKey })}
                    placeholder={(preferences.openai_api_key as string) || "sk-..."}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Google (Gemini)</label>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    onBlur={() => geminiKey !== (preferences.gemini_api_key || "") && updatePreferences({ gemini_api_key: geminiKey })}
                    placeholder={(preferences.gemini_api_key as string) || "AI..."}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-400">입력한 키는 암호화되어 저장됩니다. 비우면 서버 기본 키를 사용합니다.</p>
              </div>
            </div>

            {/* Language */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                응답 언어
              </label>
              <div className="flex gap-2">
                {languages.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => handleLanguageChange(lang.value)}
                    className={`px-4 py-2 text-sm rounded-lg border transition ${
                      (preferences.language || "ko") === lang.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Response Style */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                응답 스타일
              </label>
              <div className="flex flex-wrap gap-2">
                {styles.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleStyleChange(s.value)}
                    className={`px-4 py-2 text-sm rounded-lg border transition ${
                      (preferences.response_style || "concise") === s.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interests */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                관심사 (최대 10개)
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {(preferences.interests || []).map((interest, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm"
                  >
                    {interest}
                    <button
                      onClick={() => handleRemoveInterest(i)}
                      className="text-gray-400 hover:text-red-500 transition"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              {(preferences.interests || []).length < 10 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={interestInput}
                    onChange={(e) => setInterestInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddInterest()}
                    placeholder="새 관심사 입력..."
                    className="flex-1 px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleAddInterest}
                    disabled={!interestInput.trim()}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    추가
                  </button>
                </div>
              )}
            </div>

            {/* Push Notifications */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                푸시 알림
              </label>
              {pushSupported ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 border rounded-lg dark:border-gray-700">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">브라우저 알림</p>
                      <p className="text-xs text-gray-400">습관 리마인더를 브라우저 알림으로 받습니다</p>
                    </div>
                    <button
                      onClick={pushSubscribed ? pushUnsubscribe : pushSubscribe}
                      className={`px-3 py-1.5 text-xs rounded-lg transition ${
                        pushSubscribed
                          ? "bg-red-100 text-red-600 hover:bg-red-200"
                          : "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                      }`}
                    >
                      {pushSubscribed ? "해제" : "활성화"}
                    </button>
                  </div>
                  {pushSubscribed && (
                    <button
                      onClick={pushTest}
                      className="text-xs text-blue-500 hover:text-blue-600"
                    >
                      테스트 알림 보내기
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">이 브라우저는 푸시 알림을 지원하지 않습니다</p>
              )}
            </div>

            {saving && (
              <p className="mt-3 text-xs text-blue-500">저장 중...</p>
            )}
          </section>

          {/* Integrations */}
          <section className="bg-white dark:bg-gray-900 rounded-xl p-6 border dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              외부 서비스 연동
            </h2>

            {/* Google Calendar */}
            <div className="p-4 border dark:border-gray-700 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      Google Calendar
                    </p>
                    <p className="text-xs text-gray-500">
                      {googleCalendar?.status === "active"
                        ? "연결됨"
                        : googleCalendar?.status === "expired"
                          ? "토큰 만료 — 재연결 필요"
                          : "연결되지 않음"}
                    </p>
                  </div>
                </div>

                {googleCalendar?.status === "active" ? (
                  <button
                    onClick={() => disconnect(googleCalendar.id)}
                    className="px-4 py-2 text-sm text-red-600 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                  >
                    연결 해제
                  </button>
                ) : (
                  <button
                    onClick={handleConnect}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    연결하기
                  </button>
                )}
              </div>

              {/* OAuth credentials input — show when not connected */}
              {(!googleCalendar || googleCalendar.status !== "active") && (
                <div className="space-y-2 pt-2 border-t dark:border-gray-800">
                  <p className="text-xs text-gray-400">
                    Google Cloud Console에서 OAuth 2.0 인증 정보를 발급받아 입력하세요
                  </p>
                  <input
                    type="text"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    onBlur={() => googleClientId !== (preferences.google_client_id || "") && updatePreferences({ google_client_id: googleClientId })}
                    placeholder="Google Client ID"
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="password"
                    value={googleClientSecret}
                    onChange={(e) => setGoogleClientSecret(e.target.value)}
                    onBlur={() => googleClientSecret !== (preferences.google_client_secret || "") && updatePreferences({ google_client_secret: googleClientSecret })}
                    placeholder="Google Client Secret"
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400">
                    리다이렉트 URI:{" "}
                    <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                      http://localhost:8000/api/integrations/google/callback
                    </code>
                  </p>
                </div>
              )}

              {connectError && <p className="text-sm text-red-500">{connectError}</p>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
