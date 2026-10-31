/**
 * Structured, PII-free logging. Never pass phone numbers, UPI IDs, names,
 * provider payloads or raw input into these helpers.
 */
type LogLevel = "info" | "warn" | "error";

export interface SafeLogFields {
  requestId?: string;
  code?: string;
  provider?: string;
  stage?: string;
  durationMs?: number;
  status?: number;
}

function line(
  level: LogLevel,
  message: string,
  fields: SafeLogFields = {},
): string {
  return JSON.stringify({
    level,
    scope: "upi-pay-qr",
    message,
    ...fields,
    time: new Date().toISOString(),
  });
}

export function logInfo(message: string, fields?: SafeLogFields): void {
  console.info(line("info", message, fields));
}

export function logWarn(message: string, fields?: SafeLogFields): void {
  console.warn(line("warn", message, fields));
}

export function logError(message: string, fields?: SafeLogFields): void {
  console.error(line("error", message, fields));
}

/** Extracts only non-sensitive diagnostics from an unknown error. */
export function safeErrorDetails(error: unknown): {
  name: string;
  code?: string;
} {
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code;
    return {
      name: error.name,
      ...(typeof code === "string" ? { code } : {}),
    };
  }
  return { name: "UnknownError" };
}
