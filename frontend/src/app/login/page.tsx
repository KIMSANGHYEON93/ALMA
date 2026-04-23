"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { login, register, saveToken, findAccount, resetPassword } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Modal wrapper
// ---------------------------------------------------------------------------
function Modal({
  open,
  onClose,
  children,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Trap focus inside modal
  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const focusable = overlay.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md mx-4 p-8 bg-white dark:bg-gray-900 rounded-xl shadow-2xl space-y-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition text-xl leading-none"
        >
          &times;
        </button>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Register Modal
// ---------------------------------------------------------------------------
function RegisterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setName("");
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setError("");
    setSuccess("");
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, password, name);
      setSuccess("회원가입이 완료되었습니다. 로그인해주세요.");
      setTimeout(() => handleClose(), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "회원가입 중 오류가 발생했습니다");
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} ariaLabel="회원가입">
      <h2 className="text-xl font-bold text-center">회원가입</h2>

      {error && (
        <p role="alert" className="text-red-500 text-sm text-center">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-green-600 text-sm text-center">
          {success}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reg-name" className="sr-only">이름</label>
          <input
            id="reg-name"
            type="text"
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
        <div>
          <label htmlFor="reg-email" className="sr-only">이메일</label>
          <input
            id="reg-email"
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
        <div>
          <label htmlFor="reg-password" className="sr-only">비밀번호</label>
          <input
            id="reg-password"
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
        <div>
          <label htmlFor="reg-password-confirm" className="sr-only">비밀번호 확인</label>
          <input
            id="reg-password-confirm"
            type="password"
            placeholder="비밀번호 확인"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2 bg-sky-700 text-white rounded-lg hover:bg-sky-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSubmitting ? "처리 중..." : "회원가입"}
        </button>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Find Account / Reset Password Modal
// ---------------------------------------------------------------------------
function FindAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [foundEmail, setFoundEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setStep(1);
    setEmail("");
    setFoundEmail("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setError("");
    setSuccess("");
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleFindAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const result = await findAccount(email);
      if (result.found && result.email) {
        setFoundEmail(result.email);
        setStep(2);
      } else {
        setError("등록된 계정이 없습니다");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "계정 조회 중 오류가 발생했습니다");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== newPasswordConfirm) {
      setError("비밀번호가 일치하지 않습니다");
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(email, newPassword);
      setSuccess("비밀번호가 재설정되었습니다. 로그인해주세요.");
      setTimeout(() => handleClose(), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "비밀번호 재설정 중 오류가 발생했습니다");
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} ariaLabel="아이디/비밀번호 찾기">
      <h2 className="text-xl font-bold text-center">
        {step === 1 ? "계정 찾기" : "비밀번호 재설정"}
      </h2>

      {error && (
        <p role="alert" className="text-red-500 text-sm text-center">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-green-600 text-sm text-center">
          {success}
        </p>
      )}

      {step === 1 ? (
        <form onSubmit={handleFindAccount} className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            가입하신 이메일 주소를 입력해주세요.
          </p>
          <div>
            <label htmlFor="find-email" className="sr-only">이메일</label>
            <input
              id="find-email"
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-sky-700 text-white rounded-lg hover:bg-sky-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isSubmitting ? "조회 중..." : "계정 찾기"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">계정을 찾았습니다.</p>
            <p className="text-sm font-medium mt-1">{foundEmail}</p>
          </div>
          <div>
            <label htmlFor="reset-password" className="sr-only">새 비밀번호</label>
            <input
              id="reset-password"
              type="password"
              placeholder="새 비밀번호"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label htmlFor="reset-password-confirm" className="sr-only">새 비밀번호 확인</label>
            <input
              id="reset-password-confirm"
              type="password"
              placeholder="새 비밀번호 확인"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-sky-700 text-white rounded-lg hover:bg-sky-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isSubmitting ? "처리 중..." : "비밀번호 재설정"}
          </button>
          <button
            type="button"
            onClick={() => { setStep(1); setError(""); }}
            className="w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            다른 이메일로 찾기
          </button>
        </form>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Login Page
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showFindAccount, setShowFindAccount] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const data = await login(email, password);
      saveToken(data.access_token, data.refresh_token);
      window.location.href = "/chat";
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
        <h1 className="text-2xl font-heading font-bold text-center bg-gradient-to-r from-sky-500 to-cyan-400 bg-clip-text text-transparent">VIVARA</h1>
        <p className="text-sm text-gray-500 text-center">로그인</p>

        {error && (
          <p role="alert" className="text-red-500 text-sm text-center">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="email" className="sr-only">이메일</label>
          <input
            id="email"
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
        <div>
          <label htmlFor="password" className="sr-only">비밀번호</label>
          <input
            id="password"
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2 bg-sky-700 text-white rounded-lg hover:bg-sky-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSubmitting ? "처리 중..." : "로그인"}
        </button>

        <div className="flex flex-col items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => setShowRegister(true)}
            className="text-sm text-sky-700 hover:text-sky-800 hover:underline"
          >
            계정이 없으신가요? 회원가입
          </button>
          <button
            type="button"
            onClick={() => setShowFindAccount(true)}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:underline"
          >
            아이디/비밀번호 찾기
          </button>
        </div>
      </form>

      <RegisterModal open={showRegister} onClose={() => setShowRegister(false)} />
      <FindAccountModal open={showFindAccount} onClose={() => setShowFindAccount(false)} />
    </div>
  );
}
