import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { verifyCronSecret } from "@/lib/admin-auth";
import { purgeExpiredRequests } from "@/lib/retention";
import { logError, safeErrorDetails } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cron endpoint: POST with "Authorization: Bearer <CRON_SECRET>". */
export async function POST(request: Request): Promise<NextResponse> {
  const config = getConfig();
  if (!config.cronSecret || !verifyCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized." } },
      { status: 401 },
    );
  }

  try {
    const result = await purgeExpiredRequests();
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logError("Scheduled retention run failed", {
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

// Keep the import tree server-only and make accidental GETs explicit.
export function GET(): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } },
    { status: 405, headers: { Allow: "POST" } },
  );
}
