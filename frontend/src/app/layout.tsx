import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALMA - Adaptive Life Management Agent",
  description: "인간이 원하는 삶의 성장을 목표로 하는 AI 비서",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {children}
      </body>
    </html>
  );
}
