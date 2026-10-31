import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getConfig } from "@/lib/config";
import { constantTimeEqual } from "@/lib/crypto";

export const ADMIN_COOKIE = "upi_admin";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function secret(): string {
  return getConfig().adminSessionSecret;
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function verifyAdminPassword(candidate: string): boolean {
  const config = getConfig();
  if (!config.adminEnabled) return false;
  return constantTimeEqual(candidate, config.adminPassword);
}

export function createAdminSessionToken(now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const nonce = randomBytes(12).toString("base64url");
  const payload = `${expiresAt}.${nonce}`;
  return `${payload}.${signature(payload)}`;
}

export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiresRaw, nonce, provided] = parts;
  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt) || !nonce) return false;
  if (expiresAt <= Math.floor(Date.now() / 1000)) return false;

  const expected = signature(`${expiresRaw}.${nonce}`);
  return constantTimeEqual(provided, expected);
}

export function adminCookieOptions() {
  const config = getConfig();
  const isHttps = config.appUrl.startsWith("https://");
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const store = await cookies();
    return verifyAdminSessionToken(store.get(ADMIN_COOKIE)?.value);
  } catch {
    return false;
  }
}

export function verifyCronSecret(header: string | null): boolean {
  const config = getConfig();
  if (!config.cronSecret || config.cronSecret.length < 24) return false;
  if (!header?.startsWith("Bearer ")) return false;
  return constantTimeEqual(header.slice("Bearer ".length), config.cronSecret);
}
