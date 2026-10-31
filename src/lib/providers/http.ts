import { validateUpiId } from "@/lib/validation";
import type {
  ResolutionProvider,
  ResolutionResult,
  VerificationProvider,
  VerificationResult,
} from "./types";

interface HttpProviderOptions {
  url: string;
  apiKey: string;
  timeoutMs?: number;
}

interface HttpResponse {
  ok: boolean;
  status: number;
  body: Record<string, unknown> | null;
  raw: string;
  durationMs: number;
  error?: {
    code: string;
    message: string;
  };
}

const MAX_RAW_LENGTH = 4_000;

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return name ? name.slice(0, 200) : null;
}

function cleanString(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function truncateRaw(raw: string): unknown {
  if (raw.length <= MAX_RAW_LENGTH) return raw;
  return `${raw.slice(0, MAX_RAW_LENGTH)}…[truncated]`;
}

function statusErrorCode(status: number): string {
  if (status === 401 || status === 403) return "PROVIDER_AUTH_ERROR";
  if (status === 404) return "PROVIDER_ENDPOINT_NOT_FOUND";
  if (status === 429) return "PROVIDER_RATE_LIMITED";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "PROVIDER_HTTP_ERROR";
}

/**
 * Generic authorised-provider adapter.
 *
 * Request (POST, JSON, Authorization: Bearer <key>):
 *   resolution:   { "phone": "+919876543210" }
 *   verification: { "vpa": "name@bank" }
 *
 * Response contract:
 *   { "status": "success", "upiId"?: string, "name"?: string,
 *     "verified"?: boolean, "reference"?: string, "responseCode"?: string }
 *   { "status": "not_found" | "unverified" | "error",
 *     "responseCode"?: string, "message"?: string }
 *
 * The adapter activates only when CONFIRM_AUTHORIZED=true. It never sends or
 * stores credentials, and truncates raw responses before encrypted storage.
 */
abstract class HttpProvider {
  readonly name = "http";
  readonly displayName = "Authorised provider";
  private readonly timeoutMs: number;

  constructor(private readonly options: HttpProviderOptions) {
    this.timeoutMs = options.timeoutMs ?? 8_000;
  }

  protected async post(
    payload: Record<string, string>,
  ): Promise<HttpResponse> {
    const started = performance.now();
    let response: Response;

    try {
      response = await fetch(this.options.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: `Bearer ${this.options.apiKey}`,
          "user-agent": "upi-pay-qr/1.0 (authorised provider adapter)",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      const durationMs = Math.round(performance.now() - started);
      const name = error instanceof Error ? error.name : "UnknownError";
      const timedOut =
        name === "TimeoutError" || name === "AbortError" || name === "TimeoutError";
      return {
        ok: false,
        status: 0,
        body: null,
        raw: "",
        durationMs,
        error: {
          code: timedOut ? "PROVIDER_TIMEOUT" : "PROVIDER_NETWORK_ERROR",
          message: timedOut
            ? "The provider did not respond in time."
            : "Could not reach the provider.",
        },
      };
    }

    const raw = await response.text();
    let body: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      body = null;
    }

    const durationMs = Math.round(performance.now() - started);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        body,
        raw,
        durationMs,
        error: {
          code: statusErrorCode(response.status),
          message: `Provider returned HTTP ${response.status}.`,
        },
      };
    }

    if (!body) {
      return {
        ok: false,
        status: response.status,
        body: null,
        raw,
        durationMs,
        error: {
          code: "PROVIDER_INVALID_RESPONSE",
          message: "Provider returned a non-JSON or non-object response.",
        },
      };
    }

    return { ok: true, status: response.status, body, raw, durationMs };
  }

  protected base(result: HttpResponse): {
    durationMs: number;
    httpStatus?: number;
    responseCode: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    raw?: unknown;
  } {
    const responseCode = cleanString(result.body?.responseCode, 80);
    const providerMessage = cleanString(result.body?.message, 240);
    return {
      durationMs: result.durationMs,
      httpStatus: result.status || undefined,
      responseCode: responseCode ?? (result.status ? `HTTP_${result.status}` : null),
      errorCode: result.error?.code,
      errorMessage: result.error?.message ?? providerMessage ?? null,
      raw: truncateRaw(result.raw),
    };
  }
}

export class HttpResolutionProvider
  extends HttpProvider
  implements ResolutionProvider
{
  async resolveByPhone(normalizedPhone: string): Promise<ResolutionResult> {
    const response = await this.post({ phone: normalizedPhone });
    if (response.error) {
      return { ...this.base(response), outcome: "failed" };
    }

    const status = response.body?.status;
    if (status === "not_found") {
      return { ...this.base(response), outcome: "not_found" };
    }
    if (status === "error") {
      return {
        ...this.base(response),
        outcome: "failed",
        errorCode:
          cleanString(response.body?.errorCode, 80) ?? "PROVIDER_REPORTED_ERROR",
        errorMessage:
          cleanString(response.body?.message, 240) ??
          "The provider reported an error.",
      };
    }
    if (status !== "success") {
      return {
        ...this.base(response),
        outcome: "failed",
        errorCode: "PROVIDER_INVALID_RESPONSE",
        errorMessage: "Provider response did not include a recognised status.",
      };
    }

    const upiId = cleanString(
      response.body?.upiId ?? response.body?.vpa,
      320,
    );
    const validation = upiId ? validateUpiId(upiId) : { valid: false };
    if (!validation.valid || !validation.vpa) {
      return {
        ...this.base(response),
        outcome: "failed",
        errorCode: "PROVIDER_INVALID_UPI_ID",
        errorMessage: "Provider returned a UPI ID with an invalid format.",
      };
    }

    return {
      ...this.base(response),
      outcome: "resolved",
      upiId: validation.vpa,
      name: cleanName(response.body?.name),
      verified: response.body?.verified === true,
      reference: cleanString(response.body?.reference, 200),
    };
  }
}

export class HttpVerificationProvider
  extends HttpProvider
  implements VerificationProvider
{
  async verifyUpi(vpa: string): Promise<VerificationResult> {
    const response = await this.post({ vpa });
    if (response.error) {
      return { ...this.base(response), outcome: "failed" };
    }

    const status = response.body?.status;
    if (status === "not_found") {
      return { ...this.base(response), outcome: "not_found" };
    }
    if (status === "unverified") {
      return { ...this.base(response), outcome: "unverified" };
    }
    if (status === "error") {
      return {
        ...this.base(response),
        outcome: "failed",
        errorCode:
          cleanString(response.body?.errorCode, 80) ?? "PROVIDER_REPORTED_ERROR",
        errorMessage:
          cleanString(response.body?.message, 240) ??
          "The provider reported an error.",
      };
    }
    if (status !== "success") {
      return {
        ...this.base(response),
        outcome: "failed",
        errorCode: "PROVIDER_INVALID_RESPONSE",
        errorMessage: "Provider response did not include a recognised status.",
      };
    }

    const verified = response.body?.verified === true;
    return {
      ...this.base(response),
      outcome: verified ? "verified" : "unverified",
      name: cleanName(response.body?.name),
      verified,
      reference: cleanString(response.body?.reference, 200),
    };
  }
}
