// Utility functions for time calculations and working hours checks
// SRP: Bu dosya yalnızca zaman ve çalışma saatleri hesaplamaları içerir.

export function toMinutes(t: string): number {
  const [hh, mm] = t.split(":");
  return (parseInt(hh, 10) || 0) * 60 + (parseInt(mm, 10) || 0);
}

export function fromMinutes(total: number): string {
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function computeEndTime(startTime: string, serviceDurations: number[]): string {
  const startMin = toMinutes(startTime);
  const totalDuration = (serviceDurations || []).reduce((sum, d) => sum + (d || 0), 0);
  const endMin = startMin + totalDuration;
  return fromMinutes(endMin);
}

export function isWithinPeriod(
  startMin: number,
  endMin: number,
  period: { openMinutes?: number; closeMinutes?: number; open24h?: boolean | null }
): boolean {
  if (period.open24h) return true;
  const openMinutes = period.openMinutes ?? 9 * 60; // default 09:00
  const closeMinutes = period.closeMinutes ?? 18 * 60; // default 18:00
  return startMin >= openMinutes && endMin <= closeMinutes;
}