import { db } from "../db";
import { bookings } from "../db/schema";
import { and, eq } from "drizzle-orm";

async function main() {
  const date = process.argv[2] || "2030-02-01";
  const tenantId = process.argv[3] || "kuaforun";

  console.log(`[dev] Listing bookings for date=${date} tenant=${tenantId}`);

  const rows = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.bookingDate, date), eq(bookings.tenantId, tenantId)));

  if (rows.length === 0) {
    console.log("No bookings found.");
  } else {
    for (const r of rows) {
      console.log(
        `- id=${r.id} barberId=${r.barberId} status=${r.status} start=${r.startTime} end=${r.endTime}`
      );
    }
  }
}

main().catch((err) => {
  console.error("[dev] Failed to list bookings:", err);
  process.exit(1);
});