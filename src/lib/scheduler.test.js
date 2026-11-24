/**
 * Unit tests for the pure logic in src/lib (run with `npm test`).
 * FSRS scheduling tests run with fuzz off so intervals are exact.
 */
import { describe, it, expect } from 'vitest';
import {
  schedule, previewIntervals, newCardFields, exampleGoodIntervals, clampRetention,
  AGAIN, HARD, GOOD, EASY, DEFAULT_RETENTION,
} from './scheduler.js';
import { formatInterval } from './format.js';
import { parseImport } from './parseImport.js';
import { countDue, nextCard } from './queue.js';
import { MINUTE, DAY, addDays } from './time.js';
import { validateData, mergeData, DATA_VERSION } from './storage.js';

const NOW = new Date(2026, 10, 23, 12, 0, 0).getTime(); // local noon
const card = (fields = {}) => ({ id: 'c1', deckId: 'd1', createdAt: 0, ...newCardFields(NOW), ...fields });
const labels = (c, retention) => Object.values(previewIntervals(c, NOW, { retention })).map(formatInterval);
const exact = { fuzz: false };
/** A review card last reviewed `days` ago with that interval, due now. */
const reviewCard = (days, stability = days, difficulty = 5) =>
  card({ state: 'review', stability, difficulty, scheduled_days: days, reps: 3, last_review: NOW - days * DAY, due: NOW });
/** Rate a card several times, each time exactly when it falls due. */
function rateRepeatedly(c, rating, times, retention = DEFAULT_RETENTION) {
  const intervals = [];
  let t = c.due;
  for (let i = 0; i < times; i++) {
    c = schedule(c, rating, t, { retention, fuzz: false });
    intervals.push(c.state === 'review' ? c.scheduled_days : `${Math.round((c.due - t) / MINUTE)}m`);
    t = c.due;
  }
  return { card: c, intervals };
}

describe('FSRS learning phase', () => {
  it('keeps the same four buttons and shows 1m / 6m / 10m / 8d on a new card', () => {
    expect(labels(card())).toEqual(['1m', '6m', '10m', '8d']);
  });

  it('graduates to a day-based review after two Good ratings', () => {
    let c = schedule(card(), GOOD, NOW, exact);
    expect(c).toMatchObject({ state: 'learning', learning_steps: 1, due: NOW + 10 * MINUTE, reps: 1, last_review: NOW });
    expect(c.stability).toBeGreaterThan(0);
    expect(c.difficulty).toBeGreaterThanOrEqual(1);
    const t = c.due;
    c = schedule(c, GOOD, t, exact);
    expect(c.state).toBe('review');
    expect(c.scheduled_days).toBeGreaterThanOrEqual(1);
    expect(c.due).toBe(t + c.scheduled_days * DAY);
  });

  it('Again goes back to the first (1m) step', () => {
    const learning = schedule(card(), GOOD, NOW, exact);
    const c = schedule(learning, AGAIN, learning.due, exact);
    expect(c).toMatchObject({ state: 'learning', learning_steps: 0, due: learning.due + MINUTE });
  });

  it('Easy skips the learning steps', () => {
    const c = schedule(card(), EASY, NOW, exact);
    expect(c.state).toBe('review');
    expect(c.scheduled_days).toBeGreaterThan(1);
  });

  it('does not mutate the input card', () => {
    const c = card();
    const before = { ...c };
    schedule(c, GOOD, NOW);
    expect(c).toEqual(before);
  });
});

describe('FSRS review phase', () => {
  it('grows intervals with each successful review', () => {
    const { intervals, card: c } = rateRepeatedly(card(), GOOD, 7);
    expect(intervals.slice(0, 1)).toEqual(['10m']);
    const days = intervals.slice(1);
    days.forEach((d, i) => i && expect(d).toBeGreaterThan(days[i - 1]));
    expect(c.reps).toBe(7);
    expect(c.stability).toBeGreaterThan(30);
  });

  it('keeps Again < Hard < Good < Easy on review cards', () => {
    for (const c of [reviewCard(1, 1, 9), reviewCard(10), reviewCard(60, 60, 2)]) {
      const p = previewIntervals(c, NOW);
      expect(p[AGAIN]).toBeLessThan(DAY); // relearning step
      expect(p[HARD]).toBeLessThan(p[GOOD]);
      expect(p[GOOD]).toBeLessThan(p[EASY]);
    }
  });

  it('a lapse moves the card to relearning for 10m and lowers stability', () => {
    const before = reviewCard(20);
    const c = schedule(before, AGAIN, NOW, exact);
    expect(c).toMatchObject({ state: 'relearning', lapses: 1, due: NOW + 10 * MINUTE });
    expect(c.stability).toBeLessThan(before.stability);
    const back = schedule(c, GOOD, c.due, exact);
    expect(back.state).toBe('review');
    expect(back.scheduled_days).toBeGreaterThanOrEqual(1);
  });

  it('records elapsed_days since the previous review', () => {
    const c = schedule(reviewCard(12), GOOD, NOW, exact);
    expect(c.elapsed_days).toBe(12);
    expect(c.last_review).toBe(NOW);
    expect(schedule(card(), GOOD, NOW, exact).elapsed_days).toBe(0);
  });

  it('fuzz keeps intervals close to the exact value', () => {
    const exactDays = schedule(reviewCard(30), GOOD, NOW, exact).scheduled_days;
    for (let i = 0; i < 40; i++) {
      const d = schedule(reviewCard(30), GOOD, NOW + i * 1000).scheduled_days;
      expect(d).toBeGreaterThanOrEqual(Math.floor(exactDays * 0.75));
      expect(d).toBeLessThanOrEqual(Math.ceil(exactDays * 1.25));
    }
  });
});

describe('Target Retention', () => {
  it('higher retention schedules reviews sooner', () => {
    const good = (r) => previewIntervals(reviewCard(20), NOW, { retention: r })[GOOD];
    expect(good(0.85)).toBeGreaterThan(good(0.9));
    expect(good(0.9)).toBeGreaterThan(good(0.97));
    const long = rateRepeatedly(card(), GOOD, 5, 0.85).intervals.at(-1);
    const short = rateRepeatedly(card(), GOOD, 5, 0.97).intervals.at(-1);
    expect(long).toBeGreaterThan(short * 3);
  });

  it('does not change the (minute-based) learning steps', () => {
    expect(labels(card(), 0.85).slice(0, 3)).toEqual(labels(card(), 0.97).slice(0, 3));
  });

  it('example intervals for Settings increase and depend on retention', () => {
    const at90 = exampleGoodIntervals(0.9, 4, NOW);
    expect(at90).toHaveLength(4);
    at90.forEach((d, i) => i && expect(d).toBeGreaterThan(at90[i - 1]));
    expect(exampleGoodIntervals(0.97, 4, NOW).at(-1)).toBeLessThan(at90.at(-1));
  });

  it('clamps retention to 85%–97%', () => {
    expect([0.5, 0.85, 0.912, 0.99, 'x', undefined].map(clampRetention)).toEqual([0.85, 0.85, 0.91, 0.97, 0.9, 0.9]);
  });
});

describe('formatInterval', () => {
  it('formats each unit', () => {
    expect([30e3, MINUTE, 90 * MINUTE, DAY, 45 * DAY, 400 * DAY].map(formatInterval)).toEqual([
      '<1m', '1m', '1.5h', '1d', '1.5mo', '1.1y',
    ]);
  });
});

describe('parseImport', () => {
  it('splits on tab, dash, and skips bad lines', () => {
    const { cards, skipped } = parseImport('apple\tmanzana\ndog - perro\n\nwell-known - famous\nno separator\ncat-gato\n - empty');
    expect(cards).toEqual([
      { front: 'apple', back: 'manzana' },
      { front: 'dog', back: 'perro' },
      { front: 'well-known', back: 'famous' },
      { front: 'cat', back: 'gato' },
    ]);
    expect(skipped.map((s) => s.line)).toEqual([5, 7]);
  });
});

describe('queue', () => {
  const unlimited = () => 20;
  it('counts due cards and respects the new-card limit', () => {
    const cards = [
      card({ id: 'n1' }), card({ id: 'n2' }), card({ id: 'n3' }),
      card({ id: 'r1', state: 'review', due: NOW - DAY }),
      card({ id: 'r2', state: 'review', due: addDays(NOW, 1) }), // tomorrow: not due
      card({ id: 'l1', state: 'learning', due: NOW + 5 * MINUTE }),
    ];
    expect(countDue(cards, () => 2, NOW)).toEqual({ new: 2, learning: 1, review: 1, total: 4 });
  });

  it('shows due learning first, then reviews, then new, then learn-ahead', () => {
    const later = card({ id: 'l', state: 'learning', due: NOW + 5 * MINUTE });
    const review = card({ id: 'r', state: 'review', due: NOW - DAY });
    const fresh = card({ id: 'n' });
    expect(nextCard([fresh, later, review], unlimited, NOW).id).toBe('r');
    expect(nextCard([fresh, later], unlimited, NOW).id).toBe('n');
    expect(nextCard([later], unlimited, NOW).id).toBe('l'); // within 20m learn-ahead
    expect(nextCard([card({ state: 'learning', due: NOW + 30 * MINUTE })], unlimited, NOW)).toBeNull();
  });
});

describe('storage', () => {
  it('validates backups and drops orphaned cards', () => {
    const data = validateData({
      decks: [{ id: 'd1', name: 'A' }],
      cards: [{ id: 'c1', deckId: 'd1', front: 'f', back: 'b' }, { id: 'c2', deckId: 'missing', front: 'f', back: 'b' }],
    });
    expect(data.cards).toHaveLength(1);
    expect(data.cards[0]).toMatchObject({ state: 'new', stability: 0, difficulty: 0, reps: 0 });
    expect(data.version).toBe(DATA_VERSION);
    expect(() => validateData({ hello: 1 })).toThrow();
  });

  it('keeps v1 backups compatible with the v2 study direction', () => {
    const v1 = validateData({ version: 1, decks: [{ id: 'd1', name: 'A' }], cards: [] });
    expect(v1.decks[0].answerWith).toBe('back');
    const v2 = validateData({ version: 1, decks: [{ id: 'd1', name: 'A', answerWith: 'front' }], cards: [] });
    expect(v2.decks[0].answerWith).toBe('front');
    expect(v2.version).toBe(2);
  });

  it('adds a default target retention and clamps bad settings', () => {
    expect(validateData({ decks: [], cards: [] }).settings.targetRetention).toBe(0.9);
    const s = validateData({ decks: [], cards: [], settings: { targetRetention: 0.5, newCardsPerDay: -3 } }).settings;
    expect(s).toMatchObject({ targetRetention: 0.85, newCardsPerDay: 0 });
  });

  it('rejects backups from a newer app version', () => {
    expect(() => validateData({ version: DATA_VERSION + 1, decks: [], cards: [] })).toThrow(/newer/);
  });

  it('merges only new ids', () => {
    const a = validateData({ decks: [{ id: 'd1', name: 'A' }], cards: [{ id: 'c1', deckId: 'd1', front: 'x', back: 'y' }] });
    const b = validateData({
      decks: [{ id: 'd1', name: 'A2' }, { id: 'd2', name: 'B' }],
      cards: [{ id: 'c1', deckId: 'd1', front: 'changed', back: 'y' }, { id: 'c2', deckId: 'd2', front: 'p', back: 'q' }],
    });
    const m = mergeData(a, b);
    expect(m.decks.map((d) => d.name)).toEqual(['A', 'B']);
    expect(m.cards.map((c) => c.front)).toEqual(['x', 'p']);
  });
});
