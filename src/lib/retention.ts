import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";

export interface RetentionResult {
  deleted: number;
  retentionDays: number;
  cutoff: string;
}

/**
 * Deletes requests whose expiry timestamp has passed. Audit rows cascade with
 * the parent request. Run this from a scheduler (see README) or the admin
 * console. The policy is applied at write time: expiresAt = createdAt + N days.
 */
export async function purgeExpiredRequests(
  now = new Date(),
): Promise<RetentionResult> {
  const config = getConfig();
  const result = await prisma.paymentRequest.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  return {
    deleted: result.count,
    retentionDays: config.retentionDays,
    cutoff: now.toISOString(),
  };
}
