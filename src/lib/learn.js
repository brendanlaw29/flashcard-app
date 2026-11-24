/**
 * learn.js — adaptive "Learn" mode (Quizlet-style), as pure functions.
 *
 * Every card has a level:
 *   0 Remaining  → asked as multiple choice
 *   1 Familiar   → asked as a typed (written) answer, in a LATER round
 *   2 Mastered   → done
 *
 * The session runs in rounds of up to ROUND_SIZE cards. Each card appears
 * once per round, so a card promoted to Familiar this round only gets its
 * written prompt next round. A wrong answer drops the card back to level 0
 * and re-queues it REQUEUE_GAP questions later in the same round.
 *
 * Learn is practice only. It never changes a card's SM-2 schedule.
 */

import { shuffle } from './quiz.js';

export const ROUND_SIZE = 7;
export const REQUEUE_GAP = 2;
export const REMAINING = 0;
export const FAMILIAR = 1;
export const MASTERED = 2;

const fresh = () => ({ level: REMAINING, misses: 0, seen: false });

/**
 * Start a new Learn session for a deck.
 * @param {string[]} cardIds  Cards in deck order.
 * @param {'back'|'front'} answerWith
 */
export function createLearnSession(cardIds, answerWith) {
  return {
    answerWith,
    round: 0,
    order: [...cardIds],
    progress: Object.fromEntries(cardIds.map((id) => [id, fresh()])),
    queue: [], // card ids left in the current round, next first
    roundAnswered: 0,
    roundCorrect: 0,
  };
}

/**
 * Bring a saved session up to date with the deck: new cards join as
 * Remaining, deleted cards are dropped from progress and the queue.
 */
export function syncLearnSession(state, cardIds) {
  const ids = new Set(cardIds);
  return {
    ...state,
    order: [...cardIds],
    progress: Object.fromEntries(cardIds.map((id) => [id, state.progress[id] ?? fresh()])),
    queue: state.queue.filter((id) => ids.has(id)),
  };
}

/**
 * Pick the next round's cards: Familiar cards first (they're due their
 * written prompt), then struggling cards, then unseen cards in deck order.
 * The chosen cards are shuffled.
 */
export function startRound(state, rng = Math.random) {
  const priority = (p) => (p.level === FAMILIAR ? 0 : p.misses > 0 ? 1 : p.seen ? 2 : 3);
  const picked = state.order
    .filter((id) => state.progress[id].level < MASTERED)
    .sort((a, b) => priority(state.progress[a]) - priority(state.progress[b])) // stable: keeps deck order
    .slice(0, ROUND_SIZE);
  return { ...state, round: state.round + 1, queue: shuffle(picked, rng), roundAnswered: 0, roundCorrect: 0 };
}

/** The card id to ask next, or null when the round is over. */
export const currentCardId = (state) => state.queue[0] ?? null;

/**
 * Question type for a card: multiple choice while Remaining, written once
 * Familiar. Falls back to written if multiple choice isn't possible
 * (no distractors exist).
 * @returns {'mc'|'written'}
 */
export function questionType(state, cardId, canMultipleChoice = true) {
  return state.progress[cardId]?.level === REMAINING && canMultipleChoice ? 'mc' : 'written';
}

/**
 * Record the answer for the card at the front of the queue.
 *   correct → move up one level (Remaining → Familiar → Mastered)
 *   wrong   → back to Remaining, re-queued REQUEUE_GAP questions later
 */
export function answerCard(state, correct) {
  const [id, ...rest] = state.queue;
  if (!id) return state;
  const p = state.progress[id];
  let queue = rest;
  let next;

  if (correct) {
    next = { ...p, seen: true, level: Math.min(MASTERED, p.level + 1) };
  } else {
    next = { ...p, seen: true, level: REMAINING, misses: p.misses + 1 };
    const at = Math.min(REQUEUE_GAP, rest.length);
    queue = [...rest.slice(0, at), id, ...rest.slice(at)];
  }

  return {
    ...state,
    progress: { ...state.progress, [id]: next },
    queue,
    roundAnswered: state.roundAnswered + 1,
    roundCorrect: state.roundCorrect + (correct ? 1 : 0),
  };
}

/** Counts for the progress bar. */
export function learnCounts(state) {
  const counts = { remaining: 0, familiar: 0, mastered: 0, total: state.order.length };
  for (const id of state.order) {
    const level = state.progress[id].level;
    if (level === MASTERED) counts.mastered++;
    else if (level === FAMILIAR) counts.familiar++;
    else counts.remaining++;
  }
  return counts;
}

export const isRoundOver = (state) => state.queue.length === 0;
export const isLearnComplete = (state) => state.order.length > 0 && learnCounts(state).mastered === state.order.length;
