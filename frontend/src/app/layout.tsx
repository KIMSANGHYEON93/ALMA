import type { Metadata } from "next";
import { Lora, Raleway, Noto_Sans_KR } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lora",
  display: "swap",
});

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-raleway",
  display: "swap",
});

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VIVARA",
  description: "인간이 원하는 삶의 성장을 목표로 하는 AI 비서",
};

// FOUC 방지: 렌더링 전 테마 적용 스크립트
const themeScript = `
(function() {
  var t = localStorage.getItem('alma_theme');
  var d = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (d) document.documentElement.classList.add('dark');
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${lora.variable} ${raleway.variable} ${notoSansKR.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-vivara-surface dark:bg-vivara-surface-dark font-body">
        <a href="#main-content" className="skip-to-content">본문으로 건너뛰기</a>
        <AuthProvider>
          <main id="main-content">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
