import { db } from "../db";
import { bookings, systemSettings } from "../db/schema";
import { and, or, eq, sql, inArray } from "drizzle-orm";
import { env } from "../core/env";

/**
 * Randevu durumlarını otomatik güncelleyen script.
 * Kurallar:
 * - Geçmişte kalan (endTime + grace) randevular:
 *   - status: pending => no_show
 *   - status: confirmed & barberId IS NULL => no_show
 *   - (opsiyonel) status: confirmed & barberId IS NOT NULL => completed (AUTO_BOOKING_COMPLETE=true ise)
 *
 * Zaman hesaplaması Postgres CURRENT_DATE/CURRENT_TIME üzerinden yapılır (sunucu TZ).
 * Grace süresi BOOKING_STATUS_GRACE_MINUTES ile yapılandırılabilir.
 */

const TENANT_ID = env.TENANT_ID;
let graceMinutes = env.BOOKING_STATUS_GRACE_MINUTES;
let enableNoShow = env.AUTO_BOOKING_NO_SHOW;
let enableComplete = env.AUTO_BOOKING_COMPLETE;

async function loadSettingsFromDb() {
  try {
    const keys = [
      "booking_status_grace_minutes",
      "booking_auto_no_show",
      "booking_auto_complete",
    ];
    const rows = await db
      .select({ key: systemSettings.key, value: systemSettings.value })
      .from(systemSettings)
      .where(and(eq(systemSettings.tenantId, TENANT_ID), inArray(systemSettings.key, keys)));

    const readVal = (key: string) => {
      const row = rows.find((r) => r.key === key);
      if (!row) return undefined as unknown;
      const raw = row.value as unknown;
      if (typeof raw === "number" || typeof raw === "boolean" || typeof raw === "string") return raw;
      if (typeof raw === "object" && raw !== null) {
        const obj = raw as Record<string, unknown>;
        if (typeof obj.value === "number" || typeof obj.value === "boolean" || typeof obj.value === "string") {
          return obj.value;
        }
      }
      return undefined as unknown;
    };

    const gm = readVal("booking_status_grace_minutes");
    const ns = readVal("booking_auto_no_show");
    const cc = readVal("booking_auto_complete");

    if (typeof gm === "number" && Number.isFinite(gm) && gm >= 0) graceMinutes = Math.floor(gm);
    if (typeof ns === "boolean") enableNoShow = ns;
    if (typeof cc === "boolean") enableComplete = cc;
  } catch (err) {
    console.warn("System settings okunamadı, env değerleri kullanılacak:", err);
  }
}

function overdueCondition() {
  // Raw SQL: booking_date < CURRENT_DATE OR (booking_date = CURRENT_DATE AND end_time < CURRENT_TIME - INTERVAL 'grace minutes')
  return sql`(${bookings.bookingDate}) < CURRENT_DATE OR ((${bookings.bookingDate}) = CURRENT_DATE AND (${bookings.endTime}) < (CURRENT_TIME - make_interval(mins => ${graceMinutes})))`;
}

async function markCompleted() {
  if (!enableComplete) {
    return { affected: 0 };
  }

  const cond = and(
    eq(bookings.tenantId, TENANT_ID),
    eq(bookings.status, "confirmed"),
    overdueCondition(),
    // barberId IS NOT NULL
    sql`${bookings.barberId} IS NOT NULL`
  );

  const updated = await db
    .update(bookings)
    .set({ status: "completed", updatedAt: new Date() })
    .where(cond)
    .returning({ id: bookings.id });

  return { affected: updated.length };
}

async function markNoShow() {
  if (!enableNoShow) {
    return { affected: 0 };
  }

  const cond = and(
    eq(bookings.tenantId, TENANT_ID),
    overdueCondition(),
    // pending OR (confirmed AND barberId IS NULL)
    or(
      eq(bookings.status, "pending"),
      and(eq(bookings.status, "confirmed"), sql`${bookings.barberId} IS NULL`)
    )
  );

  const updated = await db
    .update(bookings)
    .set({ status: "no_show", updatedAt: new Date() })
    .where(cond)
    .returning({ id: bookings.id });

  return { affected: updated.length };
}

async function countCandidates() {
  const condCompleted = and(
    eq(bookings.tenantId, TENANT_ID),
    eq(bookings.status, "confirmed"),
    overdueCondition(),
    sql`${bookings.barberId} IS NOT NULL`
  );
  const condNoShow = and(
    eq(bookings.tenantId, TENANT_ID),
    overdueCondition(),
    or(eq(bookings.status, "pending"), and(eq(bookings.status, "confirmed"), sql`${bookings.barberId} IS NULL`))
  );

  const [forComplete, forNoShow] = await Promise.all([
    db
      .select({ id: bookings.id })
      .from(bookings)
      .where(condCompleted),
    db
      .select({ id: bookings.id })
      .from(bookings)
      .where(condNoShow),
  ]);

  return { complete: forComplete.length, noShow: forNoShow.length };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  // DB’den ayarları yükle (varsa)
  await loadSettingsFromDb();

  const candidates = await countCandidates();
  console.log(
    `Otomatik durum güncelleme (grace=${graceMinutes}dk, no_show=${enableNoShow}, complete=${enableComplete}, dryRun=${dryRun}):`,
    candidates
  );

  if (dryRun) {
    process.exit(0);
  }

  // Önce completed, sonra no_show
  const comp = await markCompleted();
  const noShow = await markNoShow();

  console.log(
    `Güncelleme tamamlandı: completed=${comp.affected}, no_show=${noShow.affected}`
  );
}

main().catch((err) => {
  console.error("update-booking-statuses hata:", err);
  process.exit(1);
});