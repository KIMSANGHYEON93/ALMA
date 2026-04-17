"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDarkMode } from "@/hooks/useDarkMode";

const navItems = [
  { href: "/chat", label: "대화" },
  { href: "/goals", label: "목표" },
  { href: "/habits", label: "습관" },
  { href: "/insights", label: "인사이트" },
  { href: "/knowledge", label: "지식" },
  { href: "/automations", label: "자동화" },
  { href: "/ontology", label: "온톨로지" },
  { href: "/settings", label: "설정" },
];

export default function NavBar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { isDark, toggle } = useDarkMode();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on ESC
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobileOpen]);

  return (
    <nav className="h-14 border-b dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center px-4 justify-between relative">
      <div className="flex items-center gap-6 min-w-0">
        <Link
          href="/chat"
          className="text-lg font-heading font-bold bg-gradient-to-r from-sky-500 to-cyan-400 bg-clip-text text-transparent shrink-0"
        >
          VIVARA
        </Link>
        {/* Desktop nav — hidden on mobile */}
        <div className="hidden md:flex gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                pathname.startsWith(item.href)
                  ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
          aria-pressed={isDark}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          title={isDark ? "라이트 모드" : "다크 모드"}
        >
          {isDark ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
        <button
          onClick={logout}
          className="hidden md:inline text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
        >
          로그아웃
        </button>
        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-drawer"
          className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 top-14 bg-black/30 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            id="mobile-nav-drawer"
            className="absolute top-14 left-0 right-0 bg-white dark:bg-gray-900 border-b dark:border-gray-800 shadow-lg z-50 md:hidden"
          >
            <div className="flex flex-col p-3 gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-3 rounded-lg text-sm transition ${
                    pathname.startsWith(item.href)
                      ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={logout}
                className="mt-2 pt-3 border-t dark:border-gray-800 px-4 py-3 text-left text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                로그아웃
              </button>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
