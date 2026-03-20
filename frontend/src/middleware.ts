import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 인증이 필요한 경로
const protectedPaths = ["/chat", "/settings", "/goals", "/insights"];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("alma_access_token")?.value;
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  // 보호된 경로에 토큰 없이 접근 시 로그인으로 리다이렉트
  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 인증된 사용자가 / 또는 /login 접근 시 /chat으로 리다이렉트
  if (token && (pathname === "/" || pathname === "/login")) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/chat/:path*", "/settings/:path*", "/goals/:path*", "/insights/:path*"],
};
