import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  createAdminSessionToken,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { getConfig } from "@/lib/config";
import { getClientIp, isSameOrigin } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: { code: "CROSS_ORIGIN_BLOCKED", message: "Blocked." } },
      { status: 403 },
    );
  }

  const config = getConfig();
  if (!config.adminEnabled) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "ADMIN_DISABLED",
          message:
            "The admin console is disabled. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET.",
        },
      },
      { status: 503 },
    );
  }

  const ip = getClientIp(request.headers);
  const rate = checkRateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many sign-in attempts. Try again later.",
        },
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const body = await request
    .json()
    .catch(() => null as { password?: unknown } | null);
  const password =
    body && typeof body.password === "string" ? body.password : "";

  if (!password || password.length > 512 || !verifyAdminPassword(password)) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "INVALID_CREDENTIALS", message: "Incorrect password." },
      },
      { status: 401 },
    );
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(
    ADMIN_COOKIE,
    createAdminSessionToken(),
    adminCookieOptions(),
  );
  return response;
}
