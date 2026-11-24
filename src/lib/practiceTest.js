/**
 * practiceTest.js — builds and grades Practice Tests (pure functions).
 *
 * Question shapes:
 *   { id, cardId, type: 'mc',      prompt, answer, options: string[], correctIndex }
 *   { id, cardId, type: 'tf',      prompt, answer, statement, isTrue }
 *   { id, cardId, type: 'written', prompt, answer }
 *
 * Responses: mc → option index, tf → boolean, written → string.
 * Practice tests never change a card's SM-2 schedule.
 */

import { sides, shuffle, pickDistractors, buildChoices, isWrittenCorrect } from './quiz.js';

export const QUESTION_TYPES = [
  { value: 'mc', label: 'Multiple choice' },
  { value: 'written', label: 'Written' },
  { value: 'tf', label: 'True / False' },
];

/**
 * Build a test.
 * @param {object}   opts
 * @param {object[]} opts.cards       Cards to draw questions from.
 * @param {object[]} opts.deckCards   Whole deck (distractor pool); defaults to `cards`.
 * @param {object[]} opts.otherCards  Other decks' cards (fallback distractors).
 * @param {number}   opts.count       Number of questions (capped at cards.length).
 * @param {'back'|'front'} opts.answerWith
 * @param {('mc'|'written'|'tf')[]} opts.types  At least one type.
 * @param {() => number} [opts.rng]
 */
export function buildTest({ cards, deckCards = cards, otherCards = [], count, answerWith, types, rng = Math.random }) {
  if (!types?.length) throw new Error('Choose at least one question type.');
  const chosen = shuffle(cards, rng).slice(0, Math.max(0, Math.min(count, cards.length)));
  // Spread the types evenly, then shuffle so they aren't in a fixed pattern.
  const typeList = shuffle(
    chosen.map((_, i) => types[i % types.length]),
    rng,
  );
  return chosen.map((card, i) => makeQuestion(card, typeList[i], i, { deckCards, otherCards, answerWith, rng }));
}

function makeQuestion(card, type, index, { deckCards, otherCards, answerWith, rng }) {
  const { prompt, answer } = sides(card, answerWith);
  const base = { id: `q${index + 1}`, cardId: card.id, type: 'written', prompt, answer };

  if (type === 'mc') {
    const choices = buildChoices(card, deckCards, otherCards, answerWith, rng);
    if (choices) return { ...base, type: 'mc', ...choices };
  }
  if (type === 'tf') {
    const [distractor] = pickDistractors(card, deckCards, otherCards, answerWith, 1, rng);
    if (distractor) {
      const isTrue = rng() < 0.5;
      return { ...base, type: 'tf', statement: isTrue ? answer : distractor, isTrue };
    }
  }
  return base; // written, or a fallback when no distractor exists
}

/** Has this question been answered at all? */
export function isAnswered(question, response) {
  if (question.type === 'written') return typeof response === 'string' && response.trim() !== '';
  return response !== undefined && response !== null;
}

/** Is a response correct? Unanswered questions are wrong. */
export function gradeQuestion(question, response) {
  if (!isAnswered(question, response)) return false;
  switch (question.type) {
    case 'mc':
      return response === question.correctIndex;
    case 'tf':
      return response === question.isTrue;
    default:
      return isWrittenCorrect(response, question.answer);
  }
}

/**
 * Grade a whole test.
 * @param {object[]} questions
 * @param {Record<string, any>} responses  Keyed by question id.
 */
export function gradeTest(questions, responses) {
  const results = questions.map((q) => ({ question: q, response: responses[q.id], correct: gradeQuestion(q, responses[q.id]) }));
  const correct = results.filter((r) => r.correct).length;
  return {
    results,
    correct,
    total: questions.length,
    percent: questions.length ? Math.round((correct / questions.length) * 100) : 0,
    missedCardIds: results.filter((r) => !r.correct).map((r) => r.question.cardId),
  };
}

/** Human-readable version of a response, for the results breakdown. */
export function describeResponse(question, response) {
  if (!isAnswered(question, response)) return 'No answer';
  if (question.type === 'mc') return question.options[response];
  if (question.type === 'tf') return response ? 'True' : 'False';
  return response;
}

/** Human-readable correct answer, for the results breakdown. */
export function describeCorrect(question) {
  if (question.type === 'tf') return question.isTrue ? 'True' : `False (it's “${question.answer}”)`;
  return question.answer;
}
