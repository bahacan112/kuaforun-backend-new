import { systemSettings } from "../../db/schema";
import { and, eq } from "drizzle-orm";
import { toMinutes } from "./time.utils";

// SRP: Bu dosya sadece fiyatlandırma kurallarının uygulanmasından sorumludur.
// Genişletilebilirlik için basit bir kural motoru şeklinde tasarlanmıştır.

export type PercentOrAmount = { type: "percent" | "amount"; value: number };

export interface PeakHourRule {
  weekday?: number; // 0..6
  start?: string; // HH:mm
  end?: string;   // HH:mm
  multiplier: number; // ör: 1.2
}

export interface CampaignRule extends PercentOrAmount {
  id: string;
  active?: boolean;
  shopIds?: string[];
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

export interface CouponRule extends PercentOrAmount {
  code: string;
  active?: boolean;
  maxUsagePerCustomer?: number; // şu an kontrol edilmiyor
}

export interface SegmentRule extends PercentOrAmount {
  segment: string; // ör: "student", "vip" vb.
}

export interface PricingRules {
  peakHours?: PeakHourRule[];
  offPeakMultiplier?: number; // peak değilse uygulanır, default 1.0
  campaigns?: CampaignRule[];
  coupons?: CouponRule[];
  segments?: SegmentRule[];
}

export interface PricingContext {
  campaignId?: string;
  couponCode?: string;
  customerSegment?: string;
}

export interface PricingResult {
  baseTotal: number;
  finalTotal: number;
  applied: {
    peakMultiplier?: number;
    campaignId?: string;
    couponCode?: string;
    segment?: string;
  };
}

function applyAdjustment(current: number, adj: PercentOrAmount): number {
  const v = typeof adj.value === "number" ? adj.value : 0;
  if (!Number.isFinite(v) || v <= 0) return current;
  if (adj.type === "percent") {
    return Math.max(0, Math.round(current * (1 - v / 100) * 100) / 100);
  }
  // amount
  return Math.max(0, Math.round((current - v) * 100) / 100);
}

function isDateWithin(dateStr?: string, start?: string, end?: string): boolean {
  if (!dateStr) return true;
  const d = new Date(dateStr).getTime();
  const s = start ? new Date(start).getTime() : undefined;
  const e = end ? new Date(end).getTime() : undefined;
  if (s && d < s) return false;
  if (e && d > e) return false;
  return true;
}

function isWithinTimeRange(startMin: number, endMin: number, rule: PeakHourRule): boolean {
  const s = rule.start ? toMinutes(rule.start) : 0;
  const e = rule.end ? toMinutes(rule.end) : 24 * 60;
  return startMin >= s && endMin <= e;
}

// Kuralları system_settings tablosundan okur. Yoksa varsayılan olarak herhangi bir değişiklik uygulamaz.
export async function computeDynamicPricing(
  tx: { select: Function },
  tenantId: string,
  shopId: string,
  bookingDate: string,
  startMin: number,
  endMin: number,
  baseTotal: number,
  context?: PricingContext
): Promise<PricingResult> {
  try {
    const rows = await tx
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(and(eq(systemSettings.tenantId, tenantId), eq(systemSettings.key, "pricing_rules")))
      .limit(1);

    const rulesRaw = rows.length > 0 ? (rows[0].value as unknown) : undefined;
    const rules: PricingRules | undefined = rulesRaw && typeof rulesRaw === "object" ? (rulesRaw as PricingRules) : undefined;

    let final = baseTotal;
    const applied: PricingResult["applied"] = {};

    // Peak/off-peak
    const weekday = new Date(bookingDate).getDay();
    let peakApplied = false;
    if (rules?.peakHours && Array.isArray(rules.peakHours)) {
      for (const r of rules.peakHours) {
        const wkOk = typeof r.weekday === "number" ? r.weekday === weekday : true;
        const mult = typeof r.multiplier === "number" && Number.isFinite(r.multiplier) ? r.multiplier : 1;
        if (wkOk && isWithinTimeRange(startMin, endMin, r) && mult !== 1) {
          final = Math.round(final * mult * 100) / 100;
          applied.peakMultiplier = mult;
          peakApplied = true;
          break; // ilk eşleşen kural uygulanır
        }
      }
    }
    if (!peakApplied && rules?.offPeakMultiplier && rules.offPeakMultiplier !== 1) {
      const mult = rules.offPeakMultiplier;
      final = Math.round(final * mult * 100) / 100;
      applied.peakMultiplier = mult;
    }

    // Campaign
    if (context?.campaignId && rules?.campaigns) {
      const c = rules.campaigns.find((x) => x.id === context.campaignId && (x.active ?? true));
      if (c && (!c.shopIds || c.shopIds.includes(shopId)) && isDateWithin(bookingDate, c.startDate, c.endDate)) {
        final = applyAdjustment(final, c);
        applied.campaignId = c.id;
      }
    }

    // Coupon
    if (context?.couponCode && rules?.coupons) {
      const cp = rules.coupons.find((x) => x.code === context.couponCode && (x.active ?? true));
      if (cp) {
        final = applyAdjustment(final, cp);
        applied.couponCode = cp.code;
      }
    }

    // Segment
    if (context?.customerSegment && rules?.segments) {
      const sg = rules.segments.find((x) => x.segment === context.customerSegment);
      if (sg) {
        final = applyAdjustment(final, sg);
        applied.segment = sg.segment;
      }
    }

    final = Math.round(final * 100) / 100; // iki hane
    return { baseTotal: Math.round(baseTotal * 100) / 100, finalTotal: final, applied };
  } catch {
    // Kurallar okunamazsa, güvenli fallback: baz fiyatı kullan
    return { baseTotal: Math.round(baseTotal * 100) / 100, finalTotal: Math.round(baseTotal * 100) / 100, applied: {} };
  }
}