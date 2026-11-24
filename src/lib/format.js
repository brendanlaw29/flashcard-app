/**
 * format.js — human-friendly interval labels for the rating buttons
 * and card list: "<1m", "10m", "3h", "4d", "2mo", "1.2y".
 */

import { MINUTE, HOUR, DAY } from './time.js';

/** Round to one decimal and drop a trailing ".0" (2.0 → "2", 1.25 → "1.3"). */
const oneDecimal = (n) => String(Math.round(n * 10) / 10);

/** Format a duration in ms as a compact label. */
export function formatInterval(ms) {
  if (ms < MINUTE) return '<1m';
  if (ms < HOUR) return `${Math.round(ms / MINUTE)}m`;
  if (ms < DAY) return `${oneDecimal(ms / HOUR)}h`;
  const days = ms / DAY;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${oneDecimal(days / 30)}mo`;
  return `${oneDecimal(days / 365)}y`;
}

/** Describe when a card is due relative to now: "now", "in 10m", "in 4d". */
export function formatDue(due, now = Date.now()) {
  return due <= now ? 'now' : `in ${formatInterval(due - now)}`;
}
