/** Tests for migrate.js: Version 2 (SM-2) → Version 3 (FSRS) card migration. */
import { describe, it, expect } from 'vitest';
import { migrateCard, isFsrsCard, sm2ToMemory } from './migrate.js';
import { schedule, previewIntervals, GOOD } from './scheduler.js';
import { validateData, DATA_VERSION } from './storage.js';
import { DAY, MINUTE, addDays } from './time.js';

const NOW = new Date(2026, 10, 24, 12, 0, 0).getTime();
const FSRS_FIELDS = ['state', 'due', 'stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'learning_steps', 'reps', 'lapses', 'last_review'];
const SM2_FIELDS = ['interval', 'ease', 'step'];
const v2 = (fields) => ({ id: 'c1', deckId: 'd1', front: 'f', back: 'b', createdAt: NOW - 30 * DAY, due: NOW, interval: 0, ease: 2.5, step: 0, reps: 0, lapses: 0, ...fields });

/** Every migrated card has exactly the FSRS fields and no SM-2 leftovers. */
function expectFsrsShape(c) {
  for (const f of FSRS_FIELDS) expect(c).toHaveProperty(f);
  for (const f of SM2_FIELDS) expect(c).not.toHaveProperty(f);
  expect(isFsrsCard(c)).toBe(true);
}

describe('migrateCard (v2 SM-2 → v3 FSRS)', () => {
  it('turns a new card into an FSRS new card, keeping its due date', () => {
    const c = migrateCard(v2({ state: 'new', due: NOW - 5 * DAY }), NOW);
    expectFsrsShape(c);
    expect(c).toMatchObject({ state: 'new', due: NOW - 5 * DAY, stability: 0, difficulty: 0, reps: 0, last_review: null });
    expect(c).toMatchObject({ id: 'c1', deckId: 'd1', front: 'f', back: 'b', createdAt: NOW - 30 * DAY });
  });

  it('keeps a review card’s schedule and progress', () => {
    const due = addDays(NOW, 3);
    const c = migrateCard(v2({ state: 'review', interval: 10, ease: 2.5, reps: 7, lapses: 2, due }), NOW);
    expectFsrsShape(c);
    expect(c).toMatchObject({ state: 'review', due, scheduled_days: 10, reps: 7, lapses: 2, learning_steps: 0, last_review: due - 10 * DAY });
    expect(c.stability).toBeCloseTo(10, 5); // SM-2 interval = 90%-recall interval
    expect(c.difficulty).toBeGreaterThanOrEqual(1);
    expect(c.difficulty).toBeLessThanOrEqual(10);
  });

  it('maps lower ease to higher difficulty', () => {
    const d = (ease) => sm2ToMemory(ease, 20).difficulty;
    expect(d(1.3)).toBeGreaterThan(d(2.5));
    expect(d(2.5)).toBeGreaterThan(d(3.2));
  });

  it('keeps a learning card on its step and due time', () => {
    const due = NOW + 7 * MINUTE;
    const c = migrateCard(v2({ state: 'learning', step: 1, reps: 1, due }), NOW);
    expectFsrsShape(c);
    expect(c).toMatchObject({ state: 'learning', learning_steps: 1, due, reps: 1 });
    expect(c.stability).toBeGreaterThan(0);
    expect(c.last_review).toBeLessThanOrEqual(NOW);
    // Rating it Good finishes the last step, like before.
    expect(schedule(c, GOOD, due, { fuzz: false }).state).toBe('review');
  });

  it('keeps a relearning card, its lapses, and its reduced interval', () => {
    const due = NOW + 4 * MINUTE;
    const c = migrateCard(v2({ state: 'relearning', interval: 5, ease: 2.1, reps: 9, lapses: 3, due }), NOW);
    expectFsrsShape(c);
    expect(c).toMatchObject({ state: 'relearning', due, lapses: 3, reps: 9, learning_steps: 0 });
    expect(c.stability).toBeCloseTo(5, 5);
    const back = schedule(c, GOOD, due, { fuzz: false });
    expect(back.state).toBe('review');
  });

  it('migrated review cards schedule sensibly', () => {
    const c = migrateCard(v2({ state: 'review', interval: 10, ease: 2.5, due: NOW }), NOW);
    const p = previewIntervals(c, NOW);
    expect(p[GOOD]).toBeGreaterThan(10 * DAY); // recalled at the due date → longer interval
    expect(Object.values(p).every(Number.isFinite)).toBe(true);
  });

  it('is idempotent: migrating a v3 card changes nothing', () => {
    for (const state of ['new', 'learning', 'review', 'relearning']) {
      const once = migrateCard(v2({ state, interval: 8, step: 1 }), NOW);
      expect(migrateCard(once, NOW)).toEqual(once);
    }
  });

  it('repairs bad or partial data without throwing', () => {
    const c = migrateCard({ id: 'x', deckId: 'd1', front: 'a', back: 'b', state: 'bogus', due: 'not a date' }, NOW);
    expectFsrsShape(c);
    expect(c.state).toBe('new');
    expect(Number.isFinite(c.due)).toBe(true);
    // ts-fsrs' numeric State enum and ISO dates are accepted for v3 cards.
    const n = migrateCard({ id: 'y', deckId: 'd1', front: 'a', back: 'b', state: 2, stability: 4, difficulty: 6, due: '2026-12-01T00:00:00Z' }, NOW);
    expect(n).toMatchObject({ state: 'review', due: Date.parse('2026-12-01T00:00:00Z') });
  });
});

describe('validateData migrates whole backups', () => {
  const v2Backup = {
    version: 1,
    settings: { theme: 'dark', newCardsPerDay: 15 },
    decks: [{ id: 'd1', name: 'Spanish', createdAt: 1, answerWith: 'front' }],
    cards: [
      v2({ id: 'a', state: 'new' }),
      v2({ id: 'b', state: 'review', interval: 12, ease: 2.3, reps: 4, due: addDays(NOW, 2) }),
      v2({ id: 'c', state: 'learning', step: 0, reps: 1, due: NOW + MINUTE }),
    ],
    newCardsStudied: { '2026-11-24': { d1: 3 } },
  };

  it('converts a Version 2 backup to the Version 3 format without losing progress', () => {
    const data = validateData(v2Backup, NOW);
    expect(data.version).toBe(DATA_VERSION);
    expect(data.settings).toEqual({ theme: 'dark', newCardsPerDay: 15, targetRetention: 0.9 });
    expect(data.decks[0]).toMatchObject({ name: 'Spanish', answerWith: 'front' });
    expect(data.newCardsStudied).toEqual(v2Backup.newCardsStudied);
    data.cards.forEach(expectFsrsShape);
    expect(data.cards.map((c) => [c.id, c.state, c.due, c.reps])).toEqual(v2Backup.cards.map((c) => [c.id, c.state, c.due, c.reps]));
  });

  it('a Version 3 backup round-trips unchanged', () => {
    const once = validateData(v2Backup, NOW);
    expect(validateData(JSON.parse(JSON.stringify(once)), NOW)).toEqual(once);
  });
});
