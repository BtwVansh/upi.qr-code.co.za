import type { PrismaClient } from "@prisma/client";
import { getConfig } from "@/lib/config";
import {
  blindIndex,
  encryptJson,
  encryptPii,
  hashIp,
} from "@/lib/crypto";
import { logError, logInfo, logWarn, safeErrorDetails } from "@/lib/logger";
import { generateQrPng } from "@/lib/qr";
import {
  getResolutionProvider,
  getVerificationProvider,
} from "@/lib/providers";
import type {
  ResolutionProvider,
  ResolutionResult,
  VerificationProvider,
  VerificationResult,
} from "@/lib/providers/types";
import { prisma } from "@/lib/db";
import { createRequestId } from "@/lib/request-id";
import { buildUpiUri } from "@/lib/upi";
import {
  MAX_INPUT_LENGTH,
  classifyInput,
  validateUpiId,
} from "@/lib/validation";

export interface SubmitContext {
  ip?: string | null;
  userAgent?: string | null;
}

export interface ServiceDeps {
  db: PrismaClient;
  resolutionProvider: ResolutionProvider | null;
  verificationProvider: VerificationProvider | null;
  generateQr: (payload: string) => Promise<Buffer>;
  now: () => Date;
}

export type ServiceResult =
  | { ok: true; requestId: string }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      hint?: string;
      requestId?: string;
    };

export function defaultServiceDeps(): ServiceDeps {
  return {
    db: prisma,
    resolutionProvider: getResolutionProvider(),
    verificationProvider: getVerificationProvider(),
    generateQr: (payload) => generateQrPng(payload),
    now: () => new Date(),
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function elapsedMs(started: number): number {
  return Math.max(1, Math.round(performance.now() - started));
}

function providerMetadata(result: {
  httpStatus?: number;
  responseCode?: string | null;
  verified?: boolean;
  raw?: unknown;
}): string | null {
  return encryptJson({
    httpStatus: result.httpStatus ?? null,
    responseCode: result.responseCode ?? null,
    verified: result.verified ?? null,
    raw: result.raw ?? null,
  });
}

async function recordAttempt(
  deps: ServiceDeps,
  params: {
    paymentRequestId: string;
    requestId: string;
    kind: "RESOLUTION" | "VERIFICATION";
    provider: string;
    outcome: string;
    httpStatus?: number;
    responseCode?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    durationMs: number;
  },
): Promise<void> {
  try {
    await deps.db.providerAttempt.create({
      data: {
        paymentRequestId: params.paymentRequestId,
        requestId: params.requestId,
        kind: params.kind,
        provider: params.provider,
        outcome: params.outcome,
        httpStatus: params.httpStatus ?? null,
        responseCode: params.responseCode ?? null,
        errorCode: params.errorCode ?? null,
        errorMessageEnc: encryptPii(params.errorMessage ?? null),
        durationMs: params.durationMs,
        createdAt: deps.now(),
      },
    });
  } catch (error) {
    // Audit logging must not break a payment flow, but it must be visible.
    logWarn("Could not persist provider attempt", {
      requestId: params.requestId,
      code: safeErrorDetails(error).name,
    });
  }
}

interface BaseRow {
  requestId: string;
  inputType: "PHONE" | "UPI" | "INVALID";
  normalizedValue: string | null;
  normalizedContext: "phone" | "upi";
}

async function updateFailure(
  deps: ServiceDeps,
  row: { id: string; requestId: string },
  code: string,
  message: string,
  started: number,
): Promise<void> {
  try {
    await deps.db.paymentRequest.update({
      where: { id: row.id },
      data: {
        errorCode: code,
        errorMessageEnc: encryptPii(message),
        paymentUriStatus: "FAILED",
        qrStatus: "FAILED",
        processingMs: elapsedMs(started),
      },
    });
  } catch (error) {
    logError("Could not update failed request", {
      requestId: row.requestId,
      code: safeErrorDetails(error).name,
    });
  }
}

export async function createPaymentRequest(
  rawInput: string,
  context: SubmitContext,
  deps: ServiceDeps = defaultServiceDeps(),
): Promise<ServiceResult> {
  const started = performance.now();
  const config = getConfig();
  const requestId = createRequestId();
  const now = deps.now();
  const classification = classifyInput(rawInput);

  const common = {
    requestId,
    originalInputEnc: encryptPii(
      rawInput.trim().slice(0, MAX_INPUT_LENGTH),
    ) as string,
    originalInputHash: blindIndex(rawInput, "input") as string,
    expiresAt: addDays(now, config.retentionDays),
    ipHash: hashIp(context.ip),
    userAgentEnc: encryptPii(context.userAgent?.slice(0, 512) ?? null),
    createdAt: now,
  };

  if (classification.type === "INVALID") {
    if (!classification.raw) {
      return {
        ok: false,
        status: 400,
        code: "VALIDATION_ERROR",
        message: classification.message,
      };
    }

    try {
      await deps.db.paymentRequest.create({
        data: {
          ...common,
          inputType: "INVALID",
          normalizedValueEnc: null,
          normalizedHash: null,
          resolutionStatus: "NOT_REQUIRED",
          verificationStatus: "NOT_REQUESTED",
          errorCode: "VALIDATION_ERROR",
          errorMessageEnc: encryptPii(classification.message),
          paymentUriStatus: "FAILED",
          qrStatus: "FAILED",
          processingMs: elapsedMs(started),
        },
      });
    } catch (error) {
      logError("Could not persist invalid submission", {
        requestId,
        code: safeErrorDetails(error).name,
      });
    }

    logInfo("Submission rejected by validation", { requestId });
    return {
      ok: false,
      status: 400,
      code: "VALIDATION_ERROR",
      message: classification.message,
      requestId,
    };
  }

  const baseRow: BaseRow =
    classification.type === "PHONE"
      ? {
          requestId,
          inputType: "PHONE",
          normalizedValue: classification.normalized,
          normalizedContext: "phone",
        }
      : {
          requestId,
          inputType: "UPI",
          normalizedValue: classification.vpa,
          normalizedContext: "upi",
        };

  let row: { id: string; requestId: string };
  try {
    row = await deps.db.paymentRequest.create({
      data: {
        ...common,
        inputType: baseRow.inputType,
        normalizedValueEnc: encryptPii(baseRow.normalizedValue),
        normalizedHash: blindIndex(
          baseRow.normalizedValue,
          baseRow.normalizedContext,
        ),
        resolutionStatus:
          classification.type === "PHONE"
            ? deps.resolutionProvider
              ? "PENDING"
              : "UNAVAILABLE"
            : "NOT_REQUIRED",
        verificationStatus:
          classification.type === "UPI"
            ? deps.verificationProvider
              ? "PENDING"
              : "NOT_REQUESTED"
            : "NOT_REQUESTED",
        errorCode:
          classification.type === "PHONE" && !deps.resolutionProvider
            ? "PHONE_RESOLUTION_UNAVAILABLE"
            : null,
        errorMessageEnc:
          classification.type === "PHONE" && !deps.resolutionProvider
            ? encryptPii(
                "No authorised UPI Number resolution provider is configured.",
              )
            : null,
        paymentUriStatus: "FAILED",
        qrStatus: "FAILED",
      },
      select: { id: true, requestId: true },
    });
  } catch (error) {
    logError("Could not persist payment request", {
      requestId,
      code: safeErrorDetails(error).name,
    });
    return {
      ok: false,
      status: 503,
      code: "STORAGE_UNAVAILABLE",
      message: "We couldn't save this request. Please try again.",
    };
  }

  if (classification.type === "PHONE") {
    if (!deps.resolutionProvider) {
      await deps.db.paymentRequest
        .update({
          where: { id: row.id },
          data: { processingMs: elapsedMs(started) },
        })
        .catch(() => undefined);
      logInfo("Phone resolution unavailable", { requestId });
      return {
        ok: false,
        status: 422,
        code: "PHONE_RESOLUTION_UNAVAILABLE",
        message:
          "Phone-number resolution is currently unavailable in this deployment, so we can't turn a mobile number into a UPI ID.",
        hint: "Enter the recipient's UPI ID instead — for example name@bank. You can still generate a QR and open any UPI app.",
        requestId,
      };
    }
    return resolvePhoneAndFinish(
      classification.normalized,
      row,
      deps,
      started,
      requestId,
    );
  }

  return finishUpi(
    classification.vpa,
    row,
    deps,
    started,
    requestId,
  );
}

async function resolvePhoneAndFinish(
  normalizedPhone: string,
  row: { id: string; requestId: string },
  deps: ServiceDeps,
  started: number,
  requestId: string,
): Promise<ServiceResult> {
  const provider = deps.resolutionProvider;
  if (!provider) {
    return {
      ok: false,
      status: 422,
      code: "PHONE_RESOLUTION_UNAVAILABLE",
      message: "Phone-number resolution is unavailable.",
      hint: "Enter the recipient's UPI ID instead.",
      requestId,
    };
  }

  const attemptStarted = performance.now();
  let result: ResolutionResult;
  try {
    result = await provider.resolveByPhone(normalizedPhone);
  } catch (error) {
    result = {
      outcome: "failed",
      durationMs: Math.max(1, Math.round(performance.now() - attemptStarted)),
      errorCode: "PROVIDER_EXCEPTION",
      errorMessage: "The resolution provider raised an unexpected error.",
      raw: { errorName: safeErrorDetails(error).name },
    };
  }
  if (!result.durationMs) {
    result.durationMs = Math.max(1, Math.round(performance.now() - attemptStarted));
  }

  await recordAttempt(deps, {
    paymentRequestId: row.id,
    requestId,
    kind: "RESOLUTION",
    provider: provider.name,
    outcome: result.outcome,
    httpStatus: result.httpStatus,
    responseCode: result.responseCode,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    durationMs: result.durationMs,
  });

  try {
    if (result.outcome === "resolved") {
      const validation = result.upiId ? validateUpiId(result.upiId) : null;
      if (!validation?.valid || !validation.vpa) {
        throw Object.assign(new Error("Provider returned an invalid UPI ID."), {
          publicCode: "PROVIDER_INVALID_UPI_ID",
        });
      }

      const payeeName = result.name?.trim() || null;
      const paymentUri = buildUpiUri({
        payeeVpa: validation.vpa,
        payeeName,
      });
      await deps.generateQr(paymentUri);

      await deps.db.paymentRequest.update({
        where: { id: row.id },
        data: {
          resolutionStatus: "RESOLVED",
          resolvedUpiIdEnc: encryptPii(validation.vpa),
          resolvedUpiIdHash: blindIndex(validation.vpa, "upi"),
          beneficiaryNameEnc: encryptPii(payeeName),
          beneficiaryVerified: result.verified === true,
          provider: provider.name,
          providerResponseCode: result.responseCode ?? null,
          providerReferenceEnc: encryptPii(result.reference ?? null),
          providerMetadataEnc: providerMetadata(result),
          errorCode: null,
          errorMessageEnc: null,
          paymentUriStatus: "SUCCESS",
          qrStatus: "SUCCESS",
          processingMs: elapsedMs(started),
        },
      });

      logInfo("Phone resolved and payment request generated", {
        requestId,
        provider: provider.name,
        durationMs: elapsedMs(started),
      });
      return { ok: true, requestId };
    }

    if (result.outcome === "not_found") {
      const code = result.errorCode ?? "UPI_NUMBER_NOT_FOUND";
      await deps.db.paymentRequest.update({
        where: { id: row.id },
        data: {
          resolutionStatus: "NOT_FOUND",
          provider: provider.name,
          providerResponseCode: result.responseCode ?? null,
          providerMetadataEnc: providerMetadata(result),
          errorCode: code,
          errorMessageEnc: encryptPii(
            result.errorMessage ?? "No UPI ID is linked to this number.",
          ),
          processingMs: elapsedMs(started),
        },
      });
      logInfo("Phone number not registered on UPI", { requestId });
      return {
        ok: false,
        status: 404,
        code: "UPI_NUMBER_NOT_FOUND",
        message:
          "We couldn't find a UPI ID linked to this number. It may not be registered for UPI Number payments.",
        hint: "Check the number, or enter the recipient's UPI ID directly. We never guess UPI IDs from phone numbers.",
        requestId,
      };
    }

    await deps.db.paymentRequest.update({
      where: { id: row.id },
      data: {
        resolutionStatus: "FAILED",
        provider: provider.name,
        providerResponseCode: result.responseCode ?? null,
        providerMetadataEnc: providerMetadata(result),
        errorCode: result.errorCode ?? "RESOLUTION_FAILED",
        errorMessageEnc: encryptPii(
          result.errorMessage ?? "The resolution provider failed.",
        ),
        processingMs: elapsedMs(started),
      },
    });
    logError("Phone resolution failed", {
      requestId,
      provider: provider.name,
      code: result.errorCode ?? "RESOLUTION_FAILED",
    });
    return {
      ok: false,
      status: 502,
      code: "RESOLUTION_FAILED",
      message:
        "We couldn't check this number with the UPI Number provider right now.",
      hint: "Please try again, or enter the recipient's UPI ID manually.",
      requestId,
    };
  } catch (error) {
    const publicCode =
      error instanceof Error && "publicCode" in error
        ? String((error as Error & { publicCode: string }).publicCode)
        : "REQUEST_BUILD_FAILED";
    const publicMessage =
      publicCode === "PROVIDER_INVALID_UPI_ID"
        ? "The resolution provider returned a UPI ID we couldn't use."
        : "We couldn't generate a payment QR for this number.";

    await deps.db.paymentRequest
      .update({
        where: { id: row.id },
        data: {
          resolutionStatus: "FAILED",
          provider: provider.name,
          providerResponseCode: result.responseCode ?? null,
          providerMetadataEnc: providerMetadata(result),
          errorCode: publicCode,
          errorMessageEnc: encryptPii(publicMessage),
          processingMs: elapsedMs(started),
        },
      })
      .catch((updateError: unknown) =>
        logError("Could not record failed resolution", {
          requestId,
          code: safeErrorDetails(updateError).name,
        }),
      );

    logError("Phone resolution post-processing failed", {
      requestId,
      code: publicCode,
    });
    return {
      ok: false,
      status: 502,
      code: "RESOLUTION_FAILED",
      message: publicMessage,
      hint: "Enter the recipient's UPI ID manually and try again.",
      requestId,
    };
  }
}

async function finishUpi(
  vpa: string,
  row: { id: string; requestId: string },
  deps: ServiceDeps,
  started: number,
  requestId: string,
): Promise<ServiceResult> {
  const provider = deps.verificationProvider;
  let verificationStatus: "VERIFIED" | "UNVERIFIED" | "NOT_FOUND" | "FAILED" | "NOT_REQUESTED" =
    "NOT_REQUESTED";
  let beneficiaryName: string | null = null;
  let beneficiaryVerified = false;
  let providerName: string | null = null;
  let responseCode: string | null = null;
  let errorCode: string | null = null;
  let errorMessage: string | null = null;
  let metadata: string | null = null;
  let reference: string | null = null;

  if (provider) {
    providerName = provider.name;
    const attemptStarted = performance.now();
    let result: VerificationResult;
    try {
      result = await provider.verifyUpi(vpa);
    } catch (error) {
      result = {
        outcome: "failed",
        durationMs: Math.max(1, Math.round(performance.now() - attemptStarted)),
        errorCode: "PROVIDER_EXCEPTION",
        errorMessage: "The verification provider raised an unexpected error.",
        raw: { errorName: safeErrorDetails(error).name },
      };
    }
    if (!result.durationMs) {
      result.durationMs = Math.max(
        1,
        Math.round(performance.now() - attemptStarted),
      );
    }

    await recordAttempt(deps, {
      paymentRequestId: row.id,
      requestId,
      kind: "VERIFICATION",
      provider: provider.name,
      outcome: result.outcome,
      httpStatus: result.httpStatus,
      responseCode: result.responseCode,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      durationMs: result.durationMs,
    });

    responseCode = result.responseCode ?? null;
    reference = result.reference ?? null;
    metadata = providerMetadata(result);

    if (result.outcome === "verified") {
      verificationStatus = "VERIFIED";
      beneficiaryName = result.name?.trim() || null;
      beneficiaryVerified = true;
    } else if (result.outcome === "unverified") {
      verificationStatus = "UNVERIFIED";
      beneficiaryName = result.name?.trim() || null;
    } else if (result.outcome === "not_found") {
      verificationStatus = "NOT_FOUND";
      errorCode = result.errorCode ?? "UPI_NOT_FOUND";
      errorMessage =
        result.errorMessage ??
        "The provider could not find this UPI ID. Confirm it before paying.";
    } else {
      verificationStatus = "FAILED";
      errorCode = result.errorCode ?? "VERIFICATION_FAILED";
      errorMessage =
        result.errorMessage ??
        "Beneficiary verification could not be completed.";
    }
  }

  try {
    const paymentUri = buildUpiUri({
      payeeVpa: vpa,
      payeeName: beneficiaryName,
    });
    await deps.generateQr(paymentUri);

    await deps.db.paymentRequest.update({
      where: { id: row.id },
      data: {
        verificationStatus,
        resolvedUpiIdEnc: encryptPii(vpa),
        resolvedUpiIdHash: blindIndex(vpa, "upi"),
        beneficiaryNameEnc: encryptPii(beneficiaryName),
        beneficiaryVerified,
        provider: providerName,
        providerResponseCode: responseCode,
        providerReferenceEnc: encryptPii(reference),
        providerMetadataEnc: metadata,
        errorCode,
        errorMessageEnc: encryptPii(errorMessage),
        paymentUriStatus: "SUCCESS",
        qrStatus: "SUCCESS",
        processingMs: elapsedMs(started),
      },
    });

    logInfo("UPI payment request generated", {
      requestId,
      provider: providerName ?? "none",
      code: verificationStatus,
      durationMs: elapsedMs(started),
    });
    return { ok: true, requestId };
  } catch (error) {
    await updateFailure(
      deps,
      row,
      "QR_GENERATION_FAILED",
      "The payment URI or QR code could not be generated.",
      started,
    );
    logError("QR generation failed for UPI request", {
      requestId,
      code: safeErrorDetails(error).name,
    });
    return {
      ok: false,
      status: 500,
      code: "QR_GENERATION_FAILED",
      message: "We couldn't generate the payment QR code. Please try again.",
    };
  }
}
