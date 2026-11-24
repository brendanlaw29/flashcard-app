/**
 * quiz.js — helpers shared by Flashcards, Learn, and Practice Test:
 *   - which side of a card is the prompt vs. the answer (study direction)
 *   - checking typed answers leniently
 *   - choosing "smart" multiple-choice distractors
 *   - shuffling with an injectable random source (for tests)
 *
 * Pure functions only, no React.
 */

/** Study directions. "back" = prompt shows the Front, you answer with the Back (the default). */
export const ANSWER_WITH_BACK = 'back';
export const ANSWER_WITH_FRONT = 'front';

/**
 * Prompt and answer text for a card in a given direction.
 * @param {{front: string, back: string}} card
 * @param {'back'|'front'} answerWith
 */
export function sides(card, answerWith = ANSWER_WITH_BACK) {
  return answerWith === ANSWER_WITH_FRONT
    ? { prompt: card.back, answer: card.front }
    : { prompt: card.front, answer: card.back };
}

/**
 * Normalize text for lenient comparison: ignores case, accents, punctuation,
 * and extra spaces ("  Brasília! " → "brasilia").
 */
export function normalizeAnswer(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // punctuation → space
    .replace(/\s+/g, ' ')
    .trim();
}

/** Is a typed response a correct answer? */
export function isWrittenCorrect(response, answer) {
  const a = normalizeAnswer(answer);
  // Answers made only of symbols (e.g. "+") normalize to "", so compare them literally.
  if (!a) return String(response).trim().toLowerCase() === String(answer).trim().toLowerCase();
  return normalizeAnswer(response) === a;
}

/** Return a shuffled copy of an array (Fisher–Yates). */
export function shuffle(items, rng = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isNumeric = (s) => /^\s*[-+]?[\d.,\s]+%?\s*$/.test(s);
const wordCount = (s) => s.trim().split(/\s+/).length;

/**
 * How different a candidate is from the correct answer (lower = more similar
 * = a more convincing distractor). Compares length, numbers vs. words, and
 * word count, plus some randomness so options vary between questions.
 */
function dissimilarity(answer, candidate, rng) {
  const lengthGap = Math.abs(answer.length - candidate.length) / Math.max(answer.length, candidate.length, 1);
  const kindGap = isNumeric(answer) !== isNumeric(candidate) ? 1 : 0;
  const wordGap = wordCount(answer) !== wordCount(candidate) ? 0.25 : 0;
  return lengthGap + kindGap + wordGap + rng() * 0.5;
}

/**
 * Pick up to `n` wrong answers for a card.
 *
 * Distractors come from other cards in the same deck first, then (if the
 * deck is too small) from other decks. Answers that match the correct
 * answer, or each other, after normalization are skipped. May return fewer
 * than `n` if there aren't enough distinct answers anywhere.
 *
 * @param {object}   card        The card being asked.
 * @param {object[]} deckCards   Cards in the same deck (may include `card`).
 * @param {object[]} otherCards  Cards from other decks (fallback pool).
 * @param {'back'|'front'} answerWith
 * @param {number}   [n=3]
 * @param {() => number} [rng]
 * @returns {string[]}
 */
export function pickDistractors(card, deckCards, otherCards, answerWith, n = 3, rng = Math.random) {
  const answer = sides(card, answerWith).answer;
  const keyOf = (text) => normalizeAnswer(text) || text.trim().toLowerCase();
  const used = new Set([keyOf(answer)]);
  const picked = [];

  const takeFrom = (pool) => {
    const ranked = pool
      .filter((c) => c.id !== card.id)
      .map((c) => {
        const text = sides(c, answerWith).answer;
        return { text, score: dissimilarity(answer, text, rng) };
      })
      .sort((a, b) => a.score - b.score);
    for (const { text } of ranked) {
      if (picked.length >= n) return;
      const key = keyOf(text);
      if (!text.trim() || used.has(key)) continue;
      used.add(key);
      picked.push(text);
    }
  };

  takeFrom(deckCards);
  if (picked.length < n) takeFrom(otherCards);
  return picked;
}

/**
 * Build a multiple-choice question: the correct answer plus up to 3
 * distractors, shuffled. Returns null if no distractor exists at all.
 * @returns {{options: string[], correctIndex: number} | null}
 */
export function buildChoices(card, deckCards, otherCards, answerWith, rng = Math.random) {
  const distractors = pickDistractors(card, deckCards, otherCards, answerWith, 3, rng);
  if (distractors.length === 0) return null;
  const answer = sides(card, answerWith).answer;
  const options = shuffle([answer, ...distractors], rng);
  return { options, correctIndex: options.indexOf(answer) };
}
