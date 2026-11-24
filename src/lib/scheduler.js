/**
 * scheduler.js — FSRS spaced repetition, powered by the official `ts-fsrs` package.
 *
 * FSRS models each card's memory with two numbers:
 *   - stability:  days until recall probability drops to 90%
 *   - difficulty: 1 (easy) … 10 (hard), how fast stability grows
 * and schedules the next review for when recall is expected to fall to your
 * Target Retention (default 90%). Higher retention = shorter intervals.
 *
 * Card lifecycle (same 4 buttons as before):
 *   new ──► learning (short steps: 1m, 10m) ──► review (days)
 *                                                  │  ▲
 *                                       Again ▼    │  Good after relearning step
 *                                             relearning (10m)
 *
 * This module is the only place that talks to ts-fsrs. Cards in the app
 * store plain JSON (timestamps in ms, `state` as a string), converted to
 * ts-fsrs' Card objects (Dates, numeric State enum) at this boundary.
 * Pure functions only: no React, no storage.
 */

import { fsrs, generatorParameters, createEmptyCard, Rating, State } from 'ts-fsrs';
import { DAY } from './time.js';

/** Rating values, matching the 1–4 keyboard shortcuts (same as ts-fsrs' Rating). */
export const AGAIN = Rating.Again; // 1
export const HARD = Rating.Hard; //   2
export const GOOD = Rating.Good; //   3
export const EASY = Rating.Easy; //   4

/** Target Retention bounds (fraction of reviews you expect to recall). */
export const DEFAULT_RETENTION = 0.9;
export const MIN_RETENTION = 0.85;
export const MAX_RETENTION = 0.97;

/** Learning steps, unchanged from the SM-2 version so the buttons feel the same. */
export const LEARNING_STEPS = ['1m', '10m'];
export const RELEARNING_STEPS = ['10m'];
export const MAXIMUM_INTERVAL = 36500; // days (ts-fsrs default, ~100 years)

/** App state names ↔ ts-fsrs State enum. */
const STATE_NAMES = { [State.New]: 'new', [State.Learning]: 'learning', [State.Review]: 'review', [State.Relearning]: 'relearning' };
const STATE_ENUM = { new: State.New, learning: State.Learning, review: State.Review, relearning: State.Relearning };

/** Keep a retention value inside the supported range (and default if invalid). */
export function clampRetention(retention) {
  const r = Number(retention);
  if (!Number.isFinite(r)) return DEFAULT_RETENTION;
  return Math.min(MAX_RETENTION, Math.max(MIN_RETENTION, Math.round(r * 100) / 100));
}

// One ts-fsrs scheduler per (retention, fuzz) combination, created on demand.
const schedulers = new Map();
function getScheduler(retention, fuzz) {
  const r = clampRetention(retention);
  const key = `${r}:${fuzz}`;
  if (!schedulers.has(key)) {
    schedulers.set(
      key,
      fsrs(
        generatorParameters({
          request_retention: r,
          enable_fuzz: fuzz, // small randomness so cards added together spread out
          learning_steps: LEARNING_STEPS,
          relearning_steps: RELEARNING_STEPS,
          maximum_interval: MAXIMUM_INTERVAL,
        }),
      ),
    );
  }
  return schedulers.get(key);
}

/** Default FSRS parameters (weights), used by the SM-2 → FSRS migration. */
export const DEFAULT_WEIGHTS = generatorParameters().w;

/** Scheduling fields for a brand-new card. */
export function newCardFields(now = Date.now()) {
  return {
    state: 'new',
    due: now,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0, // days between the last two reviews
    scheduled_days: 0, // interval (days) chosen at the last review
    learning_steps: 0, // index into the (re)learning steps
    reps: 0,
    lapses: 0,
    last_review: null,
  };
}

/** App card (JSON) → ts-fsrs Card. */
export function toFsrsCard(card) {
  return {
    ...createEmptyCard(new Date(card.due)),
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_ENUM[card.state] ?? State.New,
    last_review: card.last_review != null ? new Date(card.last_review) : undefined,
  };
}

/** ts-fsrs Card → the app's scheduling fields. */
function fromFsrsCard(c) {
  return {
    state: STATE_NAMES[c.state],
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    last_review: c.last_review ? c.last_review.getTime() : null,
  };
}

/**
 * Compute a card's scheduling fields after a rating.
 *
 * @param {object} card    App card with FSRS fields.
 * @param {1|2|3|4} rating AGAIN | HARD | GOOD | EASY
 * @param {number} now     Current timestamp (ms).
 * @param {object} [opts]
 * @param {number} [opts.retention=0.9] Target Retention.
 * @param {boolean} [opts.fuzz=true]    Randomize review intervals slightly.
 * @returns {object} The updated card (the input is not mutated).
 */
export function schedule(card, rating, now = Date.now(), { retention = DEFAULT_RETENTION, fuzz = true } = {}) {
  const { card: next } = getScheduler(retention, fuzz).next(toFsrsCard(card), new Date(now), rating);
  return {
    ...card,
    ...fromFsrsCard(next),
    // Whole days since the previous review (0 for a first review).
    elapsed_days: card.last_review != null ? Math.max(0, Math.floor((now - card.last_review) / DAY)) : 0,
  };
}

/**
 * Preview the next interval for each rating button, without changing the card.
 * Returns durations in ms: minutes for (re)learning steps, whole days for reviews.
 *
 * @returns {{1: number, 2: number, 3: number, 4: number}}
 */
export function previewIntervals(card, now = Date.now(), { retention = DEFAULT_RETENTION } = {}) {
  const outcomes = getScheduler(retention, false).repeat(toFsrsCard(card), new Date(now));
  const out = {};
  for (const rating of [AGAIN, HARD, GOOD, EASY]) {
    const next = outcomes[rating].card;
    out[rating] = next.state === State.Review ? next.scheduled_days * DAY : next.due.getTime() - now;
  }
  return out;
}

/**
 * Example intervals (in days) for a new card answered "Good" every time,
 * used by Settings to show what a Target Retention value means.
 */
export function exampleGoodIntervals(retention, count = 5, now = Date.now()) {
  let card = newCardFields(now);
  let t = now;
  const days = [];
  while (days.length < count) {
    card = schedule(card, GOOD, t, { retention, fuzz: false });
    t = card.due;
    if (card.state === 'review') days.push(card.scheduled_days);
  }
  return days;
}
