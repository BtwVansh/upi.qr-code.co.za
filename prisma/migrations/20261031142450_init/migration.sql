-- CreateEnum
CREATE TYPE "InputType" AS ENUM ('PHONE', 'UPI', 'INVALID');

-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('PENDING', 'RESOLVED', 'NOT_FOUND', 'UNAVAILABLE', 'FAILED', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'UNVERIFIED', 'NOT_FOUND', 'FAILED', 'NOT_REQUESTED');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ProviderKind" AS ENUM ('RESOLUTION', 'VERIFICATION');

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "requestId" VARCHAR(40) NOT NULL,
    "originalInputEnc" TEXT NOT NULL,
    "originalInputHash" VARCHAR(64) NOT NULL,
    "normalizedValueEnc" TEXT,
    "normalizedHash" VARCHAR(64),
    "inputType" "InputType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolutionStatus" "ResolutionStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "resolvedUpiIdEnc" TEXT,
    "resolvedUpiIdHash" VARCHAR(64),
    "beneficiaryNameEnc" TEXT,
    "beneficiaryVerified" BOOLEAN NOT NULL DEFAULT false,
    "provider" VARCHAR(80),
    "providerResponseCode" VARCHAR(80),
    "providerReferenceEnc" TEXT,
    "providerMetadataEnc" TEXT,
    "errorCode" VARCHAR(80),
    "errorMessageEnc" TEXT,
    "paymentUriStatus" "GenerationStatus" NOT NULL DEFAULT 'FAILED',
    "qrStatus" "GenerationStatus" NOT NULL DEFAULT 'FAILED',
    "processingMs" INTEGER NOT NULL DEFAULT 0,
    "ipHash" VARCHAR(64),
    "userAgentEnc" TEXT,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderAttempt" (
    "id" TEXT NOT NULL,
    "paymentRequestId" TEXT,
    "requestId" VARCHAR(40) NOT NULL,
    "kind" "ProviderKind" NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "outcome" VARCHAR(40) NOT NULL,
    "httpStatus" INTEGER,
    "responseCode" VARCHAR(80),
    "errorCode" VARCHAR(80),
    "errorMessageEnc" TEXT,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_requestId_key" ON "PaymentRequest"("requestId");

-- CreateIndex
CREATE INDEX "PaymentRequest_createdAt_idx" ON "PaymentRequest"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentRequest_expiresAt_idx" ON "PaymentRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "PaymentRequest_inputType_createdAt_idx" ON "PaymentRequest"("inputType", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentRequest_originalInputHash_idx" ON "PaymentRequest"("originalInputHash");

-- CreateIndex
CREATE INDEX "PaymentRequest_normalizedHash_idx" ON "PaymentRequest"("normalizedHash");

-- CreateIndex
CREATE INDEX "ProviderAttempt_requestId_idx" ON "ProviderAttempt"("requestId");

-- CreateIndex
CREATE INDEX "ProviderAttempt_createdAt_idx" ON "ProviderAttempt"("createdAt");

-- AddForeignKey
ALTER TABLE "ProviderAttempt" ADD CONSTRAINT "ProviderAttempt_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
