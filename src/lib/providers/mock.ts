import type {
  ResolutionProvider,
  ResolutionResult,
  VerificationProvider,
  VerificationResult,
} from "./types";

/**
 * TEST-ONLY provider. It is never activated unless UPI_MOCK_PROVIDER=true and
 * UPI_RESOLUTION_PROVIDER / UPI_VERIFICATION_PROVIDER is explicitly "mock".
 * The UI labels the deployment as test mode. It must never be used to imply
 * that a real mobile number belongs to a real person.
 */

const RESOLUTION_FIXTURES: Record<
  string,
  { upiId: string; name: string | null; verified: boolean }
> = {
  "+919876543210": { upiId: "demo@upi", name: "Demo User", verified: true },
  "+919123456780": {
    upiId: "merchant@upi",
    name: "Demo Merchant",
    verified: true,
  },
  "+918888888888": { upiId: "noname@upi", name: null, verified: false },
};

const VERIFICATION_FIXTURES: Record<
  string,
  { outcome: "verified" | "unverified"; name: string | null }
> = {
  "demo@upi": { outcome: "verified", name: "Demo User" },
  "merchant@upi": { outcome: "verified", name: "Demo Merchant" },
  "noname@upi": { outcome: "unverified", name: null },
  "unverified@upi": { outcome: "unverified", name: null },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockResolutionProvider implements ResolutionProvider {
  readonly name = "mock";
  readonly displayName = "Mock provider (test mode)";

  async resolveByPhone(normalizedPhone: string): Promise<ResolutionResult> {
    const started = performance.now();
    await sleep(90);
    const durationMs = Math.round(performance.now() - started);
    const base = {
      durationMs,
      httpStatus: 200,
      responseCode: "MOCK_OK",
      raw: { mock: true, fixture: normalizedPhone === "+919876543210" },
    };

    if (normalizedPhone === "+919999999999") {
      return {
        ...base,
        outcome: "not_found",
        responseCode: "MOCK_NOT_FOUND",
        errorCode: "UPI_NUMBER_NOT_FOUND",
        errorMessage: "No UPI ID is linked to this number (simulated).",
      };
    }

    if (normalizedPhone === "+919000000000") {
      return {
        ...base,
        outcome: "failed",
        httpStatus: 504,
        responseCode: "MOCK_TIMEOUT",
        errorCode: "PROVIDER_TIMEOUT",
        errorMessage: "Resolution provider timed out (simulated).",
      };
    }

    const fixture = RESOLUTION_FIXTURES[normalizedPhone];
    if (!fixture) {
      return {
        ...base,
        outcome: "not_found",
        responseCode: "MOCK_NOT_FOUND",
        errorCode: "UPI_NUMBER_NOT_FOUND",
        errorMessage: "No UPI ID is linked to this number (simulated).",
      };
    }

    return {
      ...base,
      outcome: "resolved",
      upiId: fixture.upiId,
      name: fixture.name,
      verified: fixture.verified,
      reference: `mock_ref_${normalizedPhone.slice(-4)}`,
      responseCode: "MOCK_RESOLVED",
    };
  }
}

export class MockVerificationProvider implements VerificationProvider {
  readonly name = "mock";
  readonly displayName = "Mock provider (test mode)";

  async verifyUpi(vpa: string): Promise<VerificationResult> {
    const started = performance.now();
    await sleep(80);
    const durationMs = Math.round(performance.now() - started);
    const base = {
      durationMs,
      httpStatus: 200,
      responseCode: "MOCK_VERIFIED",
      raw: { mock: true, vpa },
    };

    if (vpa === "failure@upi") {
      return {
        ...base,
        outcome: "failed",
        httpStatus: 503,
        responseCode: "MOCK_UNAVAILABLE",
        errorCode: "PROVIDER_UNAVAILABLE",
        errorMessage: "Verification provider is unavailable (simulated).",
      };
    }

    if (vpa === "missing@upi") {
      return {
        ...base,
        outcome: "not_found",
        responseCode: "MOCK_NOT_FOUND",
        errorCode: "UPI_NOT_FOUND",
        errorMessage: "UPI ID was not found (simulated).",
      };
    }

    const fixture = VERIFICATION_FIXTURES[vpa];
    if (!fixture) {
      return {
        ...base,
        outcome: "unverified",
        responseCode: "MOCK_UNVERIFIED",
        name: null,
        verified: false,
      };
    }

    return {
      ...base,
      outcome: fixture.outcome,
      name: fixture.name,
      verified: fixture.outcome === "verified",
      reference: `mock_vpa_${fixture.outcome}`,
    };
  }
}
