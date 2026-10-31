import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { isSameOrigin } from "@/lib/http";
import { purgeExpiredRequests } from "@/lib/retention";
import { logError, safeErrorDetails } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Sign in first." } },
      { status: 401 },
    );
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: { code: "CROSS_ORIGIN_BLOCKED", message: "Blocked." } },
      { status: 403 },
    );
  }

  try {
    const result = await purgeExpiredRequests();
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logError("Admin retention run failed", {
      code: safeErrorDetails(error).name,
    });
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RETENTION_FAILED",
          message: "Could not delete expired records.",
        },
      },
      { status: 500 },
    );
  }
}
