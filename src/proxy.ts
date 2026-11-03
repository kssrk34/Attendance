import { getToken } from "next-auth/jwt";
import { type NextRequest, NextResponse } from "next/server";

/** Paths anyone can open without a session. */
const PUBLIC_PATHS = ["/login", "/brand-icon"];

/**
 * Sends signed-out visitors to /login. It only reads the session cookie and never writes it:
 * a proxy that re-issued the cookie on every request could race with logout (a prefetch that
 * finishes after logout would quietly sign the user back in).
 * Real permission checks happen on the server for every page, action and query.
 */
export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return NextResponse.next();

  const secret = process.env.AUTH_SECRET;
  const token =
    (await getToken({ req, secret, secureCookie: true })) ?? (await getToken({ req, secret, secureCookie: false }));
  if (token) return NextResponse.next();

  if (path.startsWith("/api/")) return new NextResponse("Unauthorized", { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)"],
};
