import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/upload", "/admin"];

export function middleware(req: NextRequest) {
  // In local dev with emulators, skip the cookie check entirely
  if (process.env.NEXT_PUBLIC_USE_EMULATORS === "true") {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) return NextResponse.next();

  // Firebase client auth uses localStorage (not cookies) by default.
  // This provides a best-effort redirect for clearly unauthenticated users.
  // Real auth enforcement is in API routes via token verification.
  const sessionCookie = req.cookies.get("__session");
  if (!sessionCookie) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/upload/:path*", "/admin/:path*"],
};
