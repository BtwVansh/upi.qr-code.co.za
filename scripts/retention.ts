import "dotenv/config";
import { purgeExpiredRequests } from "../src/lib/retention";
import { prisma } from "../src/lib/db";

async function main(): Promise<void> {
  const result = await purgeExpiredRequests();
  console.log(
    `Retention run complete: deleted ${result.deleted} request(s) older than ${result.retentionDays} day(s).`,
  );
}

main()
  .catch((error) => {
    console.error(
      "Retention run failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
