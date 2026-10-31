import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tryDecryptPii } from "@/lib/crypto";
import { isRequestId } from "@/lib/request-id";
import { generateQrPng } from "@/lib/qr";
import { buildUpiUri } from "@/lib/upi";
import { parseAmount, parseNote } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
): Promise<Response> {
  const { requestId } = await context.params;
  if (!isRequestId(requestId)) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "QR not found." } },
      { status: 404 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const amount = parseAmount(searchParams.get("amount") ?? undefined);
  if (amount.error) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "INVALID_AMOUNT", message: amount.error },
      },
      { status: 400 },
    );
  }
  const note = parseNote(searchParams.get("note") ?? undefined);
  if (note.error) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_NOTE", message: note.error } },
      { status: 400 },
    );
  }

  let row: {
    resolvedUpiIdEnc: string | null;
    beneficiaryNameEnc: string | null;
    paymentUriStatus: string;
  } | null = null;

  try {
    row = await prisma.paymentRequest.findUnique({
      where: { requestId },
      select: {
        resolvedUpiIdEnc: true,
        beneficiaryNameEnc: true,
        paymentUriStatus: true,
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "STORAGE_UNAVAILABLE", message: "QR is unavailable." },
      },
      { status: 503 },
    );
  }

  if (!row || row.paymentUriStatus !== "SUCCESS") {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "QR not found." } },
      { status: 404 },
    );
  }

  const vpa = tryDecryptPii(row.resolvedUpiIdEnc);
  const name = tryDecryptPii(row.beneficiaryNameEnc);
  if (!vpa) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "QR not found." } },
      { status: 404 },
    );
  }

  let png: Buffer;
  try {
    const uri = buildUpiUri({
      payeeVpa: vpa,
      payeeName: name,
      amount: amount.value,
      note: note.value,
    });
    png = await generateQrPng(uri, 640);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "QR_GENERATION_FAILED",
          message: "Could not generate the QR code.",
        },
      },
      { status: 500 },
    );
  }

  const download = searchParams.get("download") === "1";
  const headers = new Headers({
    "Content-Type": "image/png",
    "Content-Length": String(png.byteLength),
    "Cache-Control": "no-store, max-age=0",
    "Content-Disposition": `${
      download ? "attachment" : "inline"
    }; filename="upi-qr-${requestId}.png"`,
    "X-Content-Type-Options": "nosniff",
  });

  return new Response(new Uint8Array(png), { status: 200, headers });
}
