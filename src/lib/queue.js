/**
 * queue.js — decides which cards are due and which card to study next.
 *
 * "Due today" means:
 *   - learning/relearning/review cards whose `due` is before local midnight, plus
 *   - new cards, up to each deck's remaining daily new-card limit.
 */

import { endOfDay, MINUTE } from './time.js';

/** Learning cards may be shown up to 20 min early when nothing else is left (like Anki). */
export const LEARN_AHEAD = 20 * MINUTE;

const isLearning = (c) => c.state === 'learning' || c.state === 'relearning';

/**
 * New cards still allowed today for one deck, oldest first.
 * @param {object[]} deckCards All cards in a single deck.
 * @param {number} remaining   How many new cards that deck may still introduce today.
 */
function newCardsAllowed(deckCards, remaining) {
  return deckCards
    .filter((c) => c.state === 'new')
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, Math.max(0, remaining));
}

/**
 * Count cards due today, split by type.
 * @param {object[]} cards         Cards to consider (any decks).
 * @param {(deckId: string) => number} newRemaining Remaining new-card allowance for a deck.
 * @returns {{new: number, learning: number, review: number, total: number}}
 */
export function countDue(cards, newRemaining, now = Date.now()) {
  const eod = endOfDay(now);
  const counts = { new: 0, learning: 0, review: 0, total: 0 };
  const byDeck = groupByDeck(cards);

  for (const [deckId, deckCards] of byDeck) {
    counts.new += newCardsAllowed(deckCards, newRemaining(deckId)).length;
    for (const c of deckCards) {
      if (c.due >= eod) continue;
      if (isLearning(c)) counts.learning++;
      else if (c.state === 'review') counts.review++;
    }
  }
  counts.total = counts.new + counts.learning + counts.review;
  return counts;
}

/**
 * Pick the next card to show in a study session, or null if nothing is ready.
 * Order: learning cards due now → reviews due today → new cards → learning
 * cards due within the learn-ahead window.
 */
export function nextCard(cards, newRemaining, now = Date.now()) {
  const eod = endOfDay(now);
  const byDue = (a, b) => a.due - b.due;

  const learning = cards.filter(isLearning).sort(byDue);
  const learningNow = learning.find((c) => c.due <= now);
  if (learningNow) return learningNow;

  const review = cards.filter((c) => c.state === 'review' && c.due < eod).sort(byDue);
  if (review.length) return review[0];

  for (const [deckId, deckCards] of groupByDeck(cards)) {
    const [first] = newCardsAllowed(deckCards, newRemaining(deckId));
    if (first) return first;
  }

  return learning.find((c) => c.due <= now + LEARN_AHEAD) ?? null;
}

/** The soonest learning card due later today (for "come back in 10m"), or null. */
export function nextLearningLater(cards, now = Date.now()) {
  const eod = endOfDay(now);
  return (
    cards
      .filter((c) => isLearning(c) && c.due > now && c.due < eod)
      .sort((a, b) => a.due - b.due)[0] ?? null
  );
}

function groupByDeck(cards) {
  const map = new Map();
  for (const c of cards) {
    if (!map.has(c.deckId)) map.set(c.deckId, []);
    map.get(c.deckId).push(c);
  }
  return map;
}
