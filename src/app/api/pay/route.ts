import { NextResponse } from "next/server";
import { createPaymentRequest, defaultServiceDeps } from "@/lib/payment-service";
import { getClientIp, isSameOrigin } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { logError, safeErrorDetails } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_192;

function jsonError(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...extra } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
    return jsonError(403, "CROSS_ORIGIN_BLOCKED", "This request was blocked.");
  }

  const ip = getClientIp(request.headers);
  const rate = checkRateLimit(`pay:${ip}`, 20, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please wait a few minutes and try again.",
        },
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Send a JSON body with an input field.",
    );
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return jsonError(413, "PAYLOAD_TOO_LARGE", "That request is too large.");
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { input?: unknown }).input !== "string"
  ) {
    return jsonError(
      400,
      "INVALID_INPUT",
      "Enter a phone number or UPI ID to continue.",
    );
  }

  try {
    const result = await createPaymentRequest(
      (body as { input: string }).input,
      {
        ip,
        userAgent: request.headers.get("user-agent"),
      },
      defaultServiceDeps(),
    );

    if (result.ok) {
      return NextResponse.json(
        {
          ok: true,
          requestId: result.requestId,
          redirectTo: `/pay/${result.requestId}`,
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: result.code,
          message: result.message,
          ...(result.hint ? { hint: result.hint } : {}),
          ...(result.requestId ? { requestId: result.requestId } : {}),
        },
      },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logError("Unhandled payment request error", {
      code: safeErrorDetails(error).name,
    });
    return jsonError(
      500,
      "INTERNAL_ERROR",
      "Something went wrong. Please try again.",
    );
  }
}
