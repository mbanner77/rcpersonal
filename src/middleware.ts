import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/login", "/api/logout", "/favicon.ico"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public assets and Next internals
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/public/")
  ) {
    return NextResponse.next();
  }

  // Allow explicitly public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const auth = req.cookies.get("rc_auth")?.value;
  if (auth === "ok") return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/|static/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js)$).*)",
  ],
};
