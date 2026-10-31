export interface ProviderResultBase {
  durationMs: number;
  httpStatus?: number;
  responseCode?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  /** Truncated provider payload for encrypted debugging storage. */
  raw?: unknown;
}

export type ResolutionOutcome = "resolved" | "not_found" | "failed";

export interface ResolutionResult extends ProviderResultBase {
  outcome: ResolutionOutcome;
  upiId?: string;
  name?: string | null;
  verified?: boolean;
  reference?: string | null;
}

export type VerificationOutcome =
  | "verified"
  | "unverified"
  | "not_found"
  | "failed";

export interface VerificationResult extends ProviderResultBase {
  outcome: VerificationOutcome;
  name?: string | null;
  verified?: boolean;
  reference?: string | null;
}

export interface ResolutionProvider {
  readonly name: string;
  readonly displayName: string;
  resolveByPhone(normalizedPhone: string): Promise<ResolutionResult>;
}

export interface VerificationProvider {
  readonly name: string;
  readonly displayName: string;
  verifyUpi(vpa: string): Promise<VerificationResult>;
}
