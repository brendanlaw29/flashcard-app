/** Tests for learn.js: round building, level progression, and re-queueing. */
import { describe, it, expect } from 'vitest';
import {
  createLearnSession, syncLearnSession, startRound, currentCardId, questionType, answerCard,
  learnCounts, isRoundOver, isLearnComplete, ROUND_SIZE, REQUEUE_GAP, REMAINING, FAMILIAR, MASTERED,
} from './learn.js';
import { seeded } from './testUtils.js';

const ids = (n) => Array.from({ length: n }, (_, i) => `c${i}`);
const level = (s, id) => s.progress[id].level;

/** Answer every question in the current round, correct or not per `judge(id)`. */
function playRound(s, judge = () => true) {
  while (!isRoundOver(s)) s = answerCard(s, judge(currentCardId(s)));
  return s;
}

describe('rounds', () => {
  it('takes at most ROUND_SIZE unmastered cards, shuffled', () => {
    const s = startRound(createLearnSession(ids(10), 'back'), seeded(2));
    expect(s.round).toBe(1);
    expect(s.queue).toHaveLength(ROUND_SIZE);
    expect(new Set(s.queue).size).toBe(ROUND_SIZE);
  });

  it('puts Familiar cards first in the next round', () => {
    let s = startRound(createLearnSession(ids(10), 'back'), seeded(4));
    const firstRound = [...s.queue];
    s = playRound(s);
    s = startRound(s, seeded(4));
    expect([...s.queue].sort()).toEqual([...firstRound].sort());
  });
});

describe('progression', () => {
  it('goes multiple choice → (later round) written → mastered', () => {
    let s = startRound(createLearnSession(ids(3), 'back'), seeded());
    const id = currentCardId(s);
    expect(questionType(s, id)).toBe('mc');

    s = answerCard(s, true);
    expect(level(s, id)).toBe(FAMILIAR);
    // Not asked again this round: the written prompt must wait for a later round.
    expect(s.queue).not.toContain(id);

    s = playRound(s);
    s = startRound(s, seeded());
    expect(s.queue).toContain(id);
    expect(questionType(s, id)).toBe('written');

    s = playRound(s);
    expect(level(s, id)).toBe(MASTERED);
    expect(isLearnComplete(s)).toBe(true);
    expect(learnCounts(s)).toEqual({ remaining: 0, familiar: 0, mastered: 3, total: 3 });
  });

  it('falls back to written when multiple choice is impossible', () => {
    const s = startRound(createLearnSession(['solo'], 'back'));
    expect(questionType(s, 'solo', false)).toBe('written');
  });

  it('a miss resets the level and re-queues the card REQUEUE_GAP questions later', () => {
    let s = startRound(createLearnSession(ids(6), 'back'), seeded(3));
    const id = currentCardId(s);
    s = answerCard(s, false);
    expect(level(s, id)).toBe(REMAINING);
    expect(s.progress[id].misses).toBe(1);
    expect(s.queue.indexOf(id)).toBe(REQUEUE_GAP);
    expect(s.roundAnswered).toBe(1);
    expect(s.roundCorrect).toBe(0);
  });

  it('a missed written answer demotes a Familiar card to multiple choice', () => {
    let s = startRound(createLearnSession(['a', 'b'], 'back'));
    s = playRound(s); // both Familiar
    s = startRound(s);
    const id = currentCardId(s);
    s = answerCard(s, false);
    expect(level(s, id)).toBe(REMAINING);
    expect(questionType(s, id)).toBe('mc');
  });

  it('re-queues a missed card right away when it is the last in the round', () => {
    let s = startRound(createLearnSession(['only'], 'back'));
    s = answerCard(s, false);
    expect(s.queue).toEqual(['only']);
  });

  it('reaches completion with a mix of right and wrong answers', () => {
    let s = createLearnSession(ids(12), 'back');
    let misses = 0;
    for (let r = 0; r < 50 && !isLearnComplete(s); r++) {
      s = startRound(s, seeded(r + 1));
      s = playRound(s, () => (misses++ % 3 !== 0)); // miss every third answer
    }
    expect(isLearnComplete(s)).toBe(true);
  });
});

describe('syncLearnSession', () => {
  it('adds new cards as Remaining and drops deleted ones', () => {
    let s = startRound(createLearnSession(['a', 'b'], 'back'));
    s = answerCard(s, true);
    const answered = Object.keys(s.progress).find((id) => s.progress[id].level === FAMILIAR);
    const kept = answered;
    const removed = answered === 'a' ? 'b' : 'a';
    s = syncLearnSession(s, [kept, 'c']);
    expect(s.order).toEqual([kept, 'c']);
    expect(level(s, kept)).toBe(FAMILIAR);
    expect(level(s, 'c')).toBe(REMAINING);
    expect(s.progress[removed]).toBeUndefined();
    expect(s.queue).not.toContain(removed);
  });
});
