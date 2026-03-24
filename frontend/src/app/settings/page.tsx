"use client";

import { useState } from "react";
import NavBar from "@/components/common/NavBar";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useIntegrations } from "@/hooks/useIntegrations";

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
  const [interestInput, setInterestInput] = useState("");
  const [connectError, setConnectError] = useState("");

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
      // 개발 환경 에러를 사용자 친화적 메시지로 변환
      if (msg.includes("not configured") || msg.includes("503")) {
        setConnectError("Google Calendar 연동은 현재 준비 중입니다. 곧 사용 가능합니다.");
      } else {
        setConnectError(msg);
      }
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
            <div className="flex items-center justify-between p-4 border dark:border-gray-700 rounded-lg">
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

            {connectError && (
              <p className="mt-2 text-sm text-red-500">{connectError}</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
