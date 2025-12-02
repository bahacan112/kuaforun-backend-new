import { db, pool } from "../db";
import { systemSettings } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { env } from "../core/env";

async function main() {
  console.log("Seeding system settings...");
  const tenantId = env.TENANT_ID;

  const defaults: Array<{ key: string; value: unknown; description: string }> = [
    {
      key: "booking_min_lead_minutes",
      value: 30,
      description: "Gelecek tarihli randevular için minimum bekleme süresi (dakika)",
    },
    {
      key: "booking_status_grace_minutes",
      value: 15,
      description: "Randevu bitişinden sonra otomatik no_show/completed için tanınan tolerans süresi (dakika)",
    },
    {
      key: "booking_auto_no_show",
      value: true,
      description: "Otomatik no_show akışı aktif/pasif",
    },
    {
      key: "booking_auto_complete",
      value: false,
      description: "Otomatik completed akışı aktif/pasif (güvenli değilse kapalı bırakın)",
    },
    // İsteğe bağlı: cron periyodu bilgilendirme amaçlı
    {
      key: "booking_cron_interval_minutes",
      value: 5,
      description: "Arka plan cron/job önerilen çalışma periyodu (dakika)",
    },
  ];

  const keys = defaults.map((d) => d.key);
  const existingRows = await db
    .select({ key: systemSettings.key })
    .from(systemSettings)
    .where(and(eq(systemSettings.tenantId, tenantId), inArray(systemSettings.key, keys)));

  const existingKeys = new Set(existingRows.map((r) => r.key));

  for (const def of defaults) {
    if (existingKeys.has(def.key)) {
      console.log(`Setting '${def.key}' already exists for tenant '${tenantId}', skipping.`);
      continue;
    }
    await db.insert(systemSettings).values({ key: def.key, value: def.value, description: def.description, tenantId });
    console.log(`Inserted default setting '${def.key}'=${JSON.stringify(def.value)} for tenant '${tenantId}'.`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});