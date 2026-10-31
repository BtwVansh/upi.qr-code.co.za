import { getConfig } from "@/lib/config";
import { HttpResolutionProvider, HttpVerificationProvider } from "./http";
import { MockResolutionProvider, MockVerificationProvider } from "./mock";
import type { ResolutionProvider, VerificationProvider } from "./types";

export function getResolutionProvider(): ResolutionProvider | null {
  const settings = getConfig().resolution;
  if (settings.mode === "mock") return new MockResolutionProvider();
  if (settings.mode === "http" && settings.url && settings.apiKey) {
    return new HttpResolutionProvider({
      url: settings.url,
      apiKey: settings.apiKey,
    });
  }
  return null;
}

export function getVerificationProvider(): VerificationProvider | null {
  const settings = getConfig().verification;
  if (settings.mode === "mock") return new MockVerificationProvider();
  if (settings.mode === "http" && settings.url && settings.apiKey) {
    return new HttpVerificationProvider({
      url: settings.url,
      apiKey: settings.apiKey,
    });
  }
  return null;
}

export interface ProviderDiagnostics {
  resolution: {
    requested: string;
    mode: string;
    active: boolean;
    inactiveReason?: string;
  };
  verification: {
    requested: string;
    mode: string;
    active: boolean;
    inactiveReason?: string;
  };
  mockEnabled: boolean;
}

/** Admin-only diagnostics. Never includes API URLs or keys. */
export function getProviderDiagnostics(): ProviderDiagnostics {
  const config = getConfig();
  return {
    resolution: {
      requested: config.resolution.requested,
      mode: config.resolution.mode,
      active: config.resolution.mode !== "disabled",
      inactiveReason: config.resolution.inactiveReason,
    },
    verification: {
      requested: config.verification.requested,
      mode: config.verification.mode,
      active: config.verification.mode !== "disabled",
      inactiveReason: config.verification.inactiveReason,
    },
    mockEnabled: config.mockProviderRequested,
  };
}
