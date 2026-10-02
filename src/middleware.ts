import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/auth";

// Routes that authenticate on their own (webhook secret, cron secret) or are the login itself.
const OPEN = ["/login", "/api/login", "/api/pluggy/webhook", "/api/cron/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (OPEN.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const expected = await sessionToken();
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Defina APP_PASSWORD nas variáveis de ambiente para usar o liu liu.", { status: 503 });
    }
    return NextResponse.next(); // local dev without a password
  }

  const got = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (safeEqual(got, expected)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Faça login de novo." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/|favicon|icon).*)"] };
