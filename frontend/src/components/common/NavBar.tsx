"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { href: "/chat", label: "대화" },
  { href: "/goals", label: "목표" },
];

export default function NavBar() {
  const pathname = usePathname();
  const { logout } = useAuth();

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
      <button
        onClick={logout}
        className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
      >
        로그아웃
      </button>
    </nav>
  );
}
