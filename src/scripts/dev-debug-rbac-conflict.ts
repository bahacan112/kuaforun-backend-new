import app from "../app";
import { db } from "../db";
import {
  barberShops,
  barberHours,
  services as servicesTable,
  shopStaff,
  users,
  bookings,
} from "../db/schema";
import { and, eq, lt, gt } from "drizzle-orm";
import crypto from "node:crypto";

function _fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function main() {
  console.log("[debug] Creating 24h shop, services, staff, users...");
  const [shop] = await db
    .insert(barberShops)
    .values({ name: "Debug RBAC Shop", address: "Addr", phone: "05551234567", gender: "unisex", tenantId: "kuaforun" })
    .returning();

  const hours = Array.from({ length: 7 }, (_, weekday) => ({
    barberShopId: shop.id,
    weekday,
    openMinutes: 0,
    closeMinutes: 24 * 60,
    open24h: true,
  }));
  await db.insert(barberHours).values(hours);

  const [svc1, svc2] = await db
    .insert(servicesTable)
    .values([
      { barberShopId: shop.id, name: "Kesim", price: "100.00", durationMinutes: 30 },
      { barberShopId: shop.id, name: "Sakal", price: "150.00", durationMinutes: 45 },
    ])
    .returning();

  const tenantId = "kuaforun";
  const [barberUser] = await db
    .insert(users)
    .values({ id: crypto.randomUUID(), tenantId })
    .returning();
  const [customerUser] = await db
    .insert(users)
    .values({ id: crypto.randomUUID(), tenantId })
    .returning();
  const [staff] = await db
    .insert(shopStaff)
    .values({ shopId: shop.id, userId: barberUser.id, role: "barber", isActive: true, tenantId })
    .returning();

  const dateStr = "2030-02-01"; // same as failing test
  const payload = {
    customerId: customerUser.id,
    barberId: staff.id,
    shopId: shop.id,
    bookingDate: dateStr,
    startTime: "10:00",
    endTime: "00:00",
    serviceIds: [svc1.id, svc2.id],
    totalPrice: 250,
    notes: "debug-rbac",
  };

  console.log("[debug] POST /bookings with payload:", payload);
  const res = await app.request("/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  console.log("[debug] Response status:", res.status);
  console.log("[debug] Response body:", body);

  // Query potential conflicts in DB for visibility
  console.log("[debug] Checking conflicts in DB...");
  const startTime = payload.startTime;
  const endTimeComputed = "11:15"; // 75 minutes after 10:00
  const conflicts = await db
    .select({ id: bookings.id, start: bookings.startTime, end: bookings.endTime })
    .from(bookings)
    .where(
      and(
        eq(bookings.tenantId, tenantId),
        eq(bookings.bookingDate, dateStr),
        eq(bookings.barberId, staff.id),
        lt(bookings.startTime, endTimeComputed),
        gt(bookings.endTime, startTime),
      ),
    )
    .limit(10);
  console.log("[debug] conflicts:", conflicts);

  console.log("[debug] Done.");
}

main().catch((e) => {
  console.error("[debug] Script error:", e);
  process.exit(1);
});