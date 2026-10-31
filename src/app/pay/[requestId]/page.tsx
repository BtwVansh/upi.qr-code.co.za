import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { tryDecryptPii } from "@/lib/crypto";
import { isRequestId } from "@/lib/request-id";
import { parseAmount, parseNote } from "@/lib/validation";
import { PaymentView } from "@/components/payment-view";
import { AlertTriangleIcon, ArrowLeftIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "UPI Payment",
  robots: { index: false, follow: false, nocache: true },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: SearchParams;
}) {
  const { requestId } = await params;
  if (!isRequestId(requestId)) notFound();

  const query = await searchParams;
  const amountResult = parseAmount(first(query.amount));
  const noteResult = parseNote(first(query.note));

  let row;
  try {
    row = await prisma.paymentRequest.findUnique({
      where: { requestId },
      select: {
        resolvedUpiIdEnc: true,
        beneficiaryNameEnc: true,
        beneficiaryVerified: true,
        verificationStatus: true,
        resolutionStatus: true,
        provider: true,
        paymentUriStatus: true,
        createdAt: true,
        expiresAt: true,
      },
    });
  } catch {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-5 pb-16 pt-20 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertTriangleIcon className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.03em]">
          Payment page temporarily unavailable
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          We couldn&apos;t load this request right now. Please try again in a
          moment.
        </p>
        <Link href="/" className="btn-secondary mt-6">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to home
        </Link>
      </div>
    );
  }

  if (!row || row.paymentUriStatus !== "SUCCESS") notFound();

  const upiId = tryDecryptPii(row.resolvedUpiIdEnc);
  if (!upiId) notFound();
  const beneficiaryName = tryDecryptPii(row.beneficiaryNameEnc);

  return (
    <PaymentView
      requestId={requestId}
      upiId={upiId}
      beneficiaryName={beneficiaryName}
      beneficiaryVerified={row.beneficiaryVerified}
      verificationStatus={row.verificationStatus}
      resolutionStatus={row.resolutionStatus}
      testMode={row.provider === "mock"}
      createdAtLabel={formatDate(row.createdAt)}
      expiresAtLabel={formatDate(row.expiresAt)}
      initialAmount={amountResult.error ? "" : (amountResult.value ?? "")}
      initialNote={noteResult.error ? "" : (noteResult.value ?? "")}
    />
  );
}
