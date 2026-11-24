/**
 * scheduler.js — Anki-style SM-2 spaced repetition.
 *
 * Pure functions only (no React, no storage), so the algorithm is easy to
 * test and can later be swapped for FSRS without touching the UI.
 *
 * Card lifecycle:
 *   new ──► learning (short steps: 1m, 10m) ──► review (days, grows by ease)
 *                                                  │  ▲
 *                                       Again ▼    │  Good after relearning steps
 *                                             relearning (10m)
 */

import { MINUTE, addDays } from './time.js';

/** Rating values, matching the 1–4 keyboard shortcuts. */
export const AGAIN = 1;
export const HARD = 2;
export const GOOD = 3;
export const EASY = 4;

/** Default settings. Step lengths are in minutes, intervals in days. */
export const CONFIG = {
  learningSteps: [1, 10],
  relearningSteps: [10],
  graduatingInterval: 1,
  easyInterval: 4,
  startingEase: 2.5,
  minEase: 1.3,
  easyBonus: 1.3,
  hardMultiplier: 1.2,
  lapseMultiplier: 0.5, // a forgotten card keeps half its interval
  maxInterval: 365,
};

/** Scheduling fields for a brand-new card. */
export function newCardFields(now = Date.now()) {
  return { state: 'new', due: now, interval: 0, ease: CONFIG.startingEase, step: 0, reps: 0, lapses: 0 };
}

/**
 * Compute a card's scheduling fields after a rating.
 *
 * @param {object} card    Card with state/due/interval/ease/step/reps/lapses.
 * @param {1|2|3|4} rating AGAIN | HARD | GOOD | EASY
 * @param {number} now     Current timestamp (ms).
 * @param {object} [opts]
 * @param {boolean} [opts.fuzz=true] Randomize long intervals slightly.
 * @returns {object} The updated scheduling fields (the input is not mutated).
 */
export function schedule(card, rating, now = Date.now(), { fuzz = true } = {}) {
  if (card.state === 'review') return scheduleReview(card, rating, now, fuzz);
  return scheduleLearning(card, rating, now);
}

/** New, learning, and relearning cards move through short minute-based steps. */
function scheduleLearning(card, rating, now) {
  const relearning = card.state === 'relearning';
  const steps = relearning ? CONFIG.relearningSteps : CONFIG.learningSteps;
  const step = Math.min(card.step, steps.length - 1);
  const stepState = relearning ? 'relearning' : 'learning';
  const atStep = (i, minutes) => ({ ...card, state: stepState, step: i, due: now + minutes * MINUTE });

  // A relearning card graduates back to its (already reduced) interval;
  // a new card graduates to the graduating interval.
  const graduate = (interval) => ({
    ...card,
    state: 'review',
    step: 0,
    interval,
    due: addDays(now, interval),
    reps: card.reps + 1,
  });

  switch (rating) {
    case AGAIN:
      // Back to the first step.
      return atStep(0, steps[0]);

    case HARD: {
      // Repeat the current step. On the first step, Anki uses the average of
      // the first two steps (1m & 10m → ~6m); with a single step, 1.5× it.
      let minutes = steps[step];
      if (step === 0) minutes = steps.length > 1 ? (steps[0] + steps[1]) / 2 : steps[0] * 1.5;
      return atStep(step, minutes);
    }

    case GOOD:
      // Advance one step, graduating after the last.
      if (step + 1 < steps.length) return atStep(step + 1, steps[step + 1]);
      return graduate(relearning ? card.interval : CONFIG.graduatingInterval);

    case EASY:
      // Skip the remaining steps.
      return graduate(relearning ? card.interval + 1 : CONFIG.easyInterval);

    default:
      throw new Error(`Unknown rating: ${rating}`);
  }
}

/** Review cards grow their interval (in days) by the ease factor. */
function scheduleReview(card, rating, now, fuzz) {
  const { interval, ease } = card;

  if (rating === AGAIN) {
    // Lapse: lower ease, halve the interval, and relearn it with short steps.
    return {
      ...card,
      state: 'relearning',
      step: 0,
      lapses: card.lapses + 1,
      ease: Math.max(CONFIG.minEase, ease - 0.2),
      interval: Math.max(1, Math.round(interval * CONFIG.lapseMultiplier)),
      due: now + CONFIG.relearningSteps[0] * MINUTE,
    };
  }

  // Compute all three so we can guarantee Hard < Good < Easy, each at least
  // one day longer than the one before.
  const hard = Math.max(interval + 1, Math.round(interval * CONFIG.hardMultiplier));
  const good = Math.max(hard + 1, Math.round(interval * ease));
  const easy = Math.max(good + 1, Math.round(interval * ease * CONFIG.easyBonus));

  const next = { [HARD]: hard, [GOOD]: good, [EASY]: easy }[rating];
  if (next === undefined) throw new Error(`Unknown rating: ${rating}`);

  const easeChange = { [HARD]: -0.15, [GOOD]: 0, [EASY]: 0.15 }[rating];
  let days = Math.min(CONFIG.maxInterval, next);
  if (fuzz) days = applyFuzz(days);

  return {
    ...card,
    interval: days,
    ease: Math.max(CONFIG.minEase, ease + easeChange),
    due: addDays(now, days),
    reps: card.reps + 1,
  };
}

/**
 * Add ±5% randomness (at least ±1 day) to intervals of 3+ days so cards
 * added together don't all come due on the same day forever.
 */
function applyFuzz(days) {
  if (days < 3) return days;
  const range = Math.max(1, Math.round(days * 0.05));
  const fuzzed = days + Math.round((Math.random() * 2 - 1) * range);
  return Math.min(CONFIG.maxInterval, Math.max(2, fuzzed));
}

/**
 * Preview the next interval for each rating button, without changing the card.
 * Returns durations in ms: minute steps for learning, whole days for reviews.
 *
 * @returns {{1: number, 2: number, 3: number, 4: number}}
 */
export function previewIntervals(card, now = Date.now()) {
  const out = {};
  for (const rating of [AGAIN, HARD, GOOD, EASY]) {
    const next = schedule(card, rating, now, { fuzz: false });
    // Review cards are due at the start of a day, so report the interval in
    // days rather than "time until midnight N days from now".
    out[rating] = next.state === 'review' ? next.interval * 24 * 60 * MINUTE : next.due - now;
  }
  return out;
}
