"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useDarkMode } from "@/hooks/useDarkMode";

const navItems = [
  { href: "/chat", label: "대화" },
  { href: "/goals", label: "목표" },
  { href: "/habits", label: "습관" },
  { href: "/insights", label: "인사이트" },
  { href: "/knowledge", label: "지식" },
  { href: "/automations", label: "자동화" },
  { href: "/settings", label: "설정" },
];

export default function NavBar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { isDark, toggle } = useDarkMode();

  return (
    <nav className="h-14 border-b dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center px-4 justify-between">
      <div className="flex items-center gap-6">
        <Link
          href="/chat"
          className="text-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent"
        >
          ALMA
        </Link>
        <div className="flex gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                pathname.startsWith(item.href)
                  ? "bg-blue-50 dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-medium"
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
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          title={isDark ? "라이트 모드" : "다크 모드"}
        >
          {isDark ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
        >
          로그아웃
        </button>
      </div>
    </nav>
  );
}
