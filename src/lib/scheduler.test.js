/**
 * Unit tests for the pure logic in src/lib (run with `npm test`).
 */
import { describe, it, expect } from 'vitest';
import { schedule, previewIntervals, newCardFields, AGAIN, HARD, GOOD, EASY, CONFIG } from './scheduler.js';
import { formatInterval } from './format.js';
import { parseImport } from './parseImport.js';
import { countDue, nextCard } from './queue.js';
import { MINUTE, DAY, addDays } from './time.js';
import { validateData, mergeData } from './storage.js';

const NOW = new Date(2026, 10, 23, 12, 0, 0).getTime(); // local noon
const card = (fields = {}) => ({ id: 'c1', deckId: 'd1', createdAt: 0, ...newCardFields(NOW), ...fields });
const labels = (c) => Object.values(previewIntervals(c, NOW)).map(formatInterval);
const reviewCard = (interval, ease = 2.5) => card({ state: 'review', interval, ease, reps: 3 });

describe('learning phase', () => {
  it('shows 1m / 6m / 10m / 4d on a new card', () => {
    expect(labels(card())).toEqual(['1m', '6m', '10m', '4d']);
  });

  it('graduates to 1 day after two Good ratings', () => {
    let c = schedule(card(), GOOD, NOW);
    expect(c).toMatchObject({ state: 'learning', step: 1, due: NOW + 10 * MINUTE });
    c = schedule(c, GOOD, NOW);
    expect(c).toMatchObject({ state: 'review', interval: 1, due: addDays(NOW, 1), reps: 1 });
  });

  it('Again resets to the first step', () => {
    const c = schedule(card({ state: 'learning', step: 1 }), AGAIN, NOW);
    expect(c).toMatchObject({ state: 'learning', step: 0, due: NOW + MINUTE });
  });

  it('Easy graduates immediately to 4 days', () => {
    expect(schedule(card(), EASY, NOW)).toMatchObject({ state: 'review', interval: 4 });
  });
});

describe('review phase', () => {
  it('Good multiplies the interval by ease', () => {
    const c = schedule(reviewCard(10), GOOD, NOW, { fuzz: false });
    expect(c).toMatchObject({ interval: 25, ease: 2.5, due: addDays(NOW, 25) });
  });

  it('keeps Hard < Good < Easy, even for tiny intervals and low ease', () => {
    for (const c of [reviewCard(1, 1.3), reviewCard(2, 1.3), reviewCard(30, 2.5)]) {
      const p = previewIntervals(c, NOW);
      expect(p[HARD]).toBeGreaterThan(c.interval * DAY);
      expect(p[GOOD]).toBeGreaterThan(p[HARD]);
      expect(p[EASY]).toBeGreaterThan(p[GOOD]);
    }
  });

  it('adjusts ease and never drops below the minimum', () => {
    expect(schedule(reviewCard(10), EASY, NOW, { fuzz: false }).ease).toBeCloseTo(2.65);
    expect(schedule(reviewCard(10), HARD, NOW, { fuzz: false }).ease).toBeCloseTo(2.35);
    expect(schedule(reviewCard(10, 1.35), AGAIN, NOW).ease).toBe(CONFIG.minEase);
  });

  it('a lapse relearns for 10m, then returns at half the interval', () => {
    let c = schedule(reviewCard(10), AGAIN, NOW);
    expect(c).toMatchObject({ state: 'relearning', lapses: 1, interval: 5, due: NOW + 10 * MINUTE });
    expect(labels(c)[GOOD - 1]).toBe('5d');
    c = schedule(c, GOOD, NOW);
    expect(c).toMatchObject({ state: 'review', interval: 5 });
  });

  it('caps intervals at the maximum and fuzz stays within ±5%', () => {
    expect(schedule(reviewCard(300), EASY, NOW, { fuzz: false }).interval).toBe(CONFIG.maxInterval);
    for (let i = 0; i < 50; i++) {
      const { interval } = schedule(reviewCard(40), GOOD, NOW); // 100d ± 5
      expect(interval).toBeGreaterThanOrEqual(95);
      expect(interval).toBeLessThanOrEqual(105);
    }
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
    expect(data.cards[0]).toMatchObject({ state: 'new', ease: 2.5 });
    expect(() => validateData({ hello: 1 })).toThrow();
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
