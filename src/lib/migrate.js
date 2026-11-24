/**
 * migrate.js — converts cards from the Version 1/2 SM-2 format to the
 * Version 3 FSRS format, keeping each card's progress.
 *
 *   SM-2 card (v1/v2): state, due, interval, ease, step, reps, lapses
 *   FSRS card (v3):    state, due, stability, difficulty, elapsed_days,
 *                      scheduled_days, learning_steps, reps, lapses, last_review
 *
 * What is kept: state, due date, reps, lapses, and the learning step, so
 * nothing becomes due earlier or later because of the upgrade.
 * Memory state for review cards is estimated from interval + ease with the
 * same formula FSRS/Anki use for SM-2 cards that have no review history.
 *
 * Migration is idempotent: an FSRS card passes through (just tidied up).
 * Pure functions only.
 */

import { newCardFields, schedule, AGAIN, GOOD, DEFAULT_WEIGHTS } from './scheduler.js';
import { DAY, MINUTE } from './time.js';

const STATES = ['new', 'learning', 'review', 'relearning'];
const SM2_RETENTION = 0.9; // SM-2 intervals are treated as "90% recall" intervals
const SM2_LEARNING_MINUTES = [1, 10]; // v2 learning steps
const SM2_RELEARNING_MINUTES = 10; //    v2 relearning step

const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Does this card already have FSRS memory fields? */
export function isFsrsCard(card) {
  return Number.isFinite(card?.stability) && Number.isFinite(card?.difficulty);
}

/**
 * Estimate FSRS stability and difficulty from an SM-2 interval and ease.
 *  - stability: the interval at which recall is SM2_RETENTION (90%), using
 *    FSRS-6's forgetting curve R = (1 + factor·t/S)^(−decay). At 90% this is
 *    simply S = interval.
 *  - difficulty: solves FSRS's "Good" stability-growth formula for D, so a
 *    card's growth rate matches its old ease factor (low ease → hard card).
 */
export function sm2ToMemory(ease, interval, w = DEFAULT_WEIGHTS) {
  const decay = w[20];
  const factor = 0.9 ** (-1 / decay) - 1;
  const stability = (Math.max(interval, 0.1) * factor) / (SM2_RETENTION ** (-1 / decay) - 1);
  const growthPerD = Math.exp(w[8]) * stability ** -w[9] * Math.expm1((1 - SM2_RETENTION) * w[10]);
  const difficulty = clamp(11 - (Math.max(ease, 1.3) - 1) / growthPerD, 1, 10);
  return { stability, difficulty };
}

/** Accept ms numbers or date strings; fall back if invalid. */
function toMs(value, fallback) {
  if (Number.isFinite(value)) return value;
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Convert one card (any version) to the Version 3 FSRS format.
 * @param {object} c    Card from localStorage or a backup file.
 * @param {number} now  Current time (ms), used to keep estimates in the past.
 */
export function migrateCard(c, now = Date.now()) {
  const createdAt = num(c.createdAt, now);
  const base = { id: c.id, deckId: c.deckId, front: c.front, back: c.back, createdAt };
  const due = toMs(c.due, createdAt);
  const reps = Math.max(0, num(c.reps, 0));
  const lapses = Math.max(0, num(c.lapses, 0));

  // ---- Already FSRS (Version 3): validate and fill gaps ----
  if (isFsrsCard(c)) {
    // Also accept ts-fsrs' numeric State enum (0–3).
    const state = typeof c.state === 'number' ? STATES[c.state] ?? 'new' : STATES.includes(c.state) ? c.state : 'new';
    const lastReview = c.last_review == null ? null : toMs(c.last_review, null);
    return {
      ...base,
      ...newCardFields(due),
      state,
      due,
      stability: Math.max(0, c.stability),
      difficulty: state === 'new' ? 0 : clamp(c.difficulty, 1, 10),
      elapsed_days: Math.max(0, num(c.elapsed_days, 0)),
      scheduled_days: Math.max(0, num(c.scheduled_days, 0)),
      learning_steps: Math.max(0, Math.floor(num(c.learning_steps, 0))),
      reps,
      lapses,
      last_review: state === 'new' ? null : lastReview,
    };
  }

  // ---- SM-2 card (Version 1/2) ----
  const state = STATES.includes(c.state) ? c.state : 'new';
  const ease = num(c.ease, 2.5);
  const interval = Math.max(1, num(c.interval, 1));
  const step = Math.max(0, Math.floor(num(c.step, 0)));

  switch (state) {
    case 'learning': {
      // Rebuild the memory state FSRS would have after the first rating
      // (Again keeps a card on step 0, Good moves it to step 1).
      const s = Math.min(step, SM2_LEARNING_MINUTES.length - 1);
      const lastReview = Math.min(now, due - SM2_LEARNING_MINUTES[s] * MINUTE);
      const first = schedule(newCardFields(lastReview), s === 0 ? AGAIN : GOOD, lastReview, { fuzz: false });
      return {
        ...base,
        ...first,
        due, // keep the original due time
        learning_steps: s,
        reps: Math.max(reps, 1),
        lapses,
        last_review: lastReview,
        elapsed_days: 0,
        scheduled_days: 0,
      };
    }

    case 'review':
    case 'relearning': {
      // A v2 relearning card already holds its reduced post-lapse interval.
      const { stability, difficulty } = sm2ToMemory(ease, interval);
      const relearning = state === 'relearning';
      const lastReview = Math.min(now, relearning ? due - SM2_RELEARNING_MINUTES * MINUTE : due - interval * DAY);
      return {
        ...base,
        state,
        due,
        stability,
        difficulty,
        elapsed_days: 0, // unknown: SM-2 didn't record the previous gap
        scheduled_days: relearning ? 0 : interval,
        learning_steps: 0,
        reps: Math.max(reps, 1),
        lapses,
        last_review: lastReview,
      };
    }

    default:
      return { ...base, ...newCardFields(due) };
  }
}
