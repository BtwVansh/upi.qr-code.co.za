/** Request metadata helpers that do not persist raw IP addresses. */

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Rejects cross-site browser POSTs. Requests without an Origin header (curl,
 * server-to-server) are allowed through and still rate limited.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("host");
  try {
    const originUrl = new URL(origin);
    if (host && originUrl.host === host) return true;

    const configured = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
    if (configured) {
      return originUrl.origin === new URL(configured).origin;
    }
  } catch {
    return false;
  }
  return false;
}

export function clientRateLimitKey(headers: Headers): string {
  return getClientIp(headers);
}
