/**
 * Server-side configuration. Nothing in this module may be imported by a
 * client component. Secrets are only read through explicit accessors.
 */

export type ProviderMode = "disabled" | "mock" | "http";
export type RequestedProvider = "none" | "mock" | "http";

export interface ProviderSettings {
  /** Value requested via the environment. */
  requested: RequestedProvider;
  /** Effective mode after safety checks. */
  mode: ProviderMode;
  /** Human-readable reason when a provider was requested but not activated. */
  inactiveReason?: string;
  url?: string;
  apiKey?: string;
}

export interface AppConfig {
  appUrl: string;
  isProduction: boolean;
  retentionDays: number;
  adminEnabled: boolean;
  adminPassword: string;
  adminSessionSecret: string;
  cronSecret: string;
  encryptionKeyPresent: boolean;
  indexKeyPresent: boolean;
  mockProviderRequested: boolean;
  resolution: ProviderSettings;
  verification: ProviderSettings;
}

function trimmed(name: string): string {
  return (process.env[name] ?? "").trim();
}

function requestedProvider(value: string): RequestedProvider {
  const normalized = value.toLowerCase();
  if (normalized === "mock" || normalized === "http") return normalized;
  return "none";
}

function httpsOrLocalhost(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

function resolveProviderSettings(
  kind: "resolution" | "verification",
  mockEnabled: boolean,
): ProviderSettings {
  const prefix = kind === "resolution" ? "UPI_RESOLUTION" : "UPI_VERIFICATION";
  const requested = requestedProvider(trimmed(`${prefix}_PROVIDER`));

  if (requested === "none") {
    return { requested, mode: "disabled" };
  }

  if (requested === "mock") {
    if (!mockEnabled) {
      return {
        requested,
        mode: "disabled",
        inactiveReason: "Mock provider requires UPI_MOCK_PROVIDER=true.",
      };
    }
    return { requested, mode: "mock" };
  }

  const url = trimmed(`${prefix}_API_URL`);
  const apiKey = trimmed(`${prefix}_API_KEY`);
  const confirmed =
    trimmed(`${prefix}_CONFIRM_AUTHORIZED`).toLowerCase() === "true";

  if (!url || !apiKey) {
    return {
      requested,
      mode: "disabled",
      inactiveReason: `${prefix}_API_URL and ${prefix}_API_KEY must both be set.`,
    };
  }
  if (!httpsOrLocalhost(url)) {
    return {
      requested,
      mode: "disabled",
      inactiveReason: `${prefix}_API_URL must use HTTPS.`,
    };
  }
  if (!confirmed) {
    return {
      requested,
      mode: "disabled",
      inactiveReason: `Set ${prefix}_CONFIRM_AUTHORIZED=true only if you are authorised to use this provider.`,
    };
  }

  return { requested, mode: "http", url, apiKey };
}

export function getConfig(): AppConfig {
  const isProduction = process.env.NODE_ENV === "production";
  const mockEnabled = trimmed("UPI_MOCK_PROVIDER").toLowerCase() === "true";
  const retentionRaw = Number.parseInt(trimmed("RETENTION_DAYS") || "30", 10);
  const retentionDays = Number.isFinite(retentionRaw)
    ? Math.min(3650, Math.max(1, retentionRaw))
    : 30;

  const adminPassword = trimmed("ADMIN_PASSWORD");
  const adminSessionSecret = trimmed("ADMIN_SESSION_SECRET");
  const adminEnabled =
    adminPassword.length >= 12 && adminSessionSecret.length >= 32;

  const appUrl = (
    trimmed("NEXT_PUBLIC_APP_URL") ||
    `http://localhost:${trimmed("PORT") || "3000"}`
  ).replace(/\/+$/, "");

  return {
    appUrl,
    isProduction,
    retentionDays,
    adminEnabled,
    adminPassword,
    adminSessionSecret,
    cronSecret: trimmed("CRON_SECRET"),
    encryptionKeyPresent: trimmed("APP_ENCRYPTION_KEY").length > 0,
    indexKeyPresent: trimmed("APP_INDEX_KEY").length > 0,
    mockProviderRequested: mockEnabled,
    resolution: resolveProviderSettings("resolution", mockEnabled),
    verification: resolveProviderSettings("verification", mockEnabled),
  };
}

export interface PublicProviderInfo {
  resolutionAvailable: boolean;
  verificationAvailable: boolean;
  resolutionMode: ProviderMode;
  verificationMode: ProviderMode;
  testMode: boolean;
}

/**
 * Safe subset for rendering. Never includes provider URLs, keys or reasons
 * that could reveal infrastructure details.
 */
export function getPublicProviderInfo(): PublicProviderInfo {
  const config = getConfig();
  return {
    resolutionAvailable: config.resolution.mode !== "disabled",
    verificationAvailable: config.verification.mode !== "disabled",
    resolutionMode: config.resolution.mode,
    verificationMode: config.verification.mode,
    testMode:
      config.resolution.mode === "mock" || config.verification.mode === "mock",
  };
}
