"use client";

import { useState } from "react";
import { login, register, saveToken } from "@/lib/auth";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const data = isRegister
        ? await register(email, password, displayName)
        : await login(email, password);
      saveToken(data.access_token, data.refresh_token);
      window.location.href = "/";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "인증 오류가 발생했습니다");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm p-8 bg-white dark:bg-gray-900 rounded-xl shadow-lg space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">ALMA</h1>
        <p className="text-sm text-gray-500 text-center">
          {isRegister ? "회원가입" : "로그인"}
        </p>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        {isRegister && (
          <input
            type="text"
            placeholder="이름"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        )}
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSubmitting ? "처리 중..." : isRegister ? "회원가입" : "로그인"}
        </button>

        <button
          type="button"
          onClick={() => setIsRegister(!isRegister)}
          className="w-full text-sm text-blue-600 hover:underline"
        >
          {isRegister
            ? "이미 계정이 있으신가요? 로그인"
            : "계정이 없으신가요? 회원가입"}
        </button>
      </form>
    </div>
  );
}
