/** Tests for practiceTest.js: building and grading practice tests. */
import { describe, it, expect } from 'vitest';
import { buildTest, gradeTest, gradeQuestion, describeResponse, describeCorrect } from './practiceTest.js';
import { seeded } from './testUtils.js';

const deck = ['Paris', 'Tokyo', 'Cairo', 'Oslo', 'Rome', 'Lima', 'Seoul', 'Hanoi', 'Rabat', 'Accra'].map((back, i) => ({
  id: `c${i}`,
  deckId: 'd1',
  front: `Capital ${i}`,
  back,
}));

describe('buildTest', () => {
  it('respects the question count and uses each card once', () => {
    const qs = buildTest({ cards: deck, count: 6, answerWith: 'back', types: ['written'], rng: seeded() });
    expect(qs).toHaveLength(6);
    expect(new Set(qs.map((q) => q.cardId)).size).toBe(6);
    expect(buildTest({ cards: deck, count: 99, answerWith: 'back', types: ['mc'] })).toHaveLength(10);
  });

  it('spreads the selected types evenly', () => {
    const qs = buildTest({ cards: deck, count: 9, answerWith: 'back', types: ['mc', 'written', 'tf'], rng: seeded(2) });
    const count = (t) => qs.filter((q) => q.type === t).length;
    expect([count('mc'), count('written'), count('tf')]).toEqual([3, 3, 3]);
  });

  it('builds valid multiple-choice and true/false questions', () => {
    const qs = buildTest({ cards: deck, count: 10, answerWith: 'back', types: ['mc', 'tf'], rng: seeded(3) });
    for (const q of qs) {
      const card = deck.find((c) => c.id === q.cardId);
      expect(q.prompt).toBe(card.front);
      if (q.type === 'mc') {
        expect(q.options).toHaveLength(4);
        expect(q.options[q.correctIndex]).toBe(card.back);
      } else {
        expect(q.isTrue).toBe(q.statement === card.back);
      }
    }
  });

  it('prompts with the Back when answering with the Front', () => {
    const [q] = buildTest({ cards: deck, count: 1, answerWith: 'front', types: ['written'], rng: seeded() });
    const card = deck.find((c) => c.id === q.cardId);
    expect(q).toMatchObject({ prompt: card.back, answer: card.front });
  });

  it('turns mc/tf into written when no distractor exists', () => {
    const qs = buildTest({ cards: [deck[0]], count: 1, answerWith: 'back', types: ['mc', 'tf'] });
    expect(qs[0].type).toBe('written');
  });

  it('draws retake questions from missed cards but distractors from the whole deck', () => {
    const qs = buildTest({ cards: [deck[0]], deckCards: deck, count: 1, answerWith: 'back', types: ['mc'], rng: seeded() });
    expect(qs[0].type).toBe('mc');
    expect(qs[0].options).toHaveLength(4);
  });

  it('requires at least one question type', () => {
    expect(() => buildTest({ cards: deck, count: 3, answerWith: 'back', types: [] })).toThrow();
  });
});

describe('grading', () => {
  const mc = { id: 'q1', cardId: 'c0', type: 'mc', prompt: 'p', answer: 'Paris', options: ['Rome', 'Paris'], correctIndex: 1 };
  const tf = { id: 'q2', cardId: 'c1', type: 'tf', prompt: 'p', answer: 'Tokyo', statement: 'Oslo', isTrue: false };
  const wr = { id: 'q3', cardId: 'c2', type: 'written', prompt: 'p', answer: 'Brasília' };

  it('grades each question type', () => {
    expect(gradeQuestion(mc, 1)).toBe(true);
    expect(gradeQuestion(mc, 0)).toBe(false);
    expect(gradeQuestion(tf, false)).toBe(true);
    expect(gradeQuestion(tf, true)).toBe(false);
    expect(gradeQuestion(wr, 'brasilia')).toBe(true);
    expect(gradeQuestion(wr, '')).toBe(false);
    expect(gradeQuestion(mc, undefined)).toBe(false);
  });

  it('computes the score, percentage, and missed cards', () => {
    const r = gradeTest([mc, tf, wr], { q1: 1, q2: true });
    expect(r).toMatchObject({ correct: 1, total: 3, percent: 33, missedCardIds: ['c1', 'c2'] });
    expect(r.results.map((x) => x.correct)).toEqual([true, false, false]);
  });

  it('describes responses and answers for the breakdown', () => {
    expect(describeResponse(mc, 0)).toBe('Rome');
    expect(describeResponse(tf, true)).toBe('True');
    expect(describeResponse(wr, undefined)).toBe('No answer');
    expect(describeCorrect(tf)).toBe('False (it\'s “Tokyo”)');
    expect(describeCorrect(mc)).toBe('Paris');
  });
});
