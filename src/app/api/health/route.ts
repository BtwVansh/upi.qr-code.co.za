import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function databaseHealthy(): Promise<boolean> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 3_000),
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function GET(): Promise<NextResponse> {
  const config = getConfig();
  const db = await databaseHealthy();

  return NextResponse.json(
    {
      status: db ? "ok" : "degraded",
      database: db ? "up" : "down",
      providers: {
        phoneResolution: config.resolution.mode,
        beneficiaryVerification: config.verification.mode,
        mock: config.mockProviderRequested,
      },
      encryptionConfigured: config.encryptionKeyPresent && config.indexKeyPresent,
      adminConfigured: config.adminEnabled,
      retentionDays: config.retentionDays,
      time: new Date().toISOString(),
    },
    {
      status: db ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
