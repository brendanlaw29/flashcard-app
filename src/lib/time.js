/**
 * time.js — small date helpers. All "days" are local calendar days,
 * so the daily rollover happens at the user's local midnight.
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Timestamp (ms) of local midnight at the start of the day containing `ts`. */
export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Timestamp (ms) of local midnight at the end of the day containing `ts`. */
export function endOfDay(ts) {
  const d = new Date(ts);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

/** Start of the local day `days` calendar days after `ts` (DST-safe). */
export function addDays(ts, days) {
  const d = new Date(startOfDay(ts));
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Local date key like "2026-11-23", used to track new cards studied per day. */
export function dayKey(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
