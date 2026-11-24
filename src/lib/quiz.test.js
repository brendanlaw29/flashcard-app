/** Tests for quiz.js: direction, answer checking, and distractor selection. */
import { describe, it, expect } from 'vitest';
import { seeded } from './testUtils.js';
import { sides, isWrittenCorrect, pickDistractors, buildChoices, shuffle, normalizeAnswer } from './quiz.js';


const mk = (id, front, back, deckId = 'd1') => ({ id, deckId, front, back });

describe('sides', () => {
  const card = mk('c', 'perro', 'dog');
  it('prompts with the Front by default', () => {
    expect(sides(card)).toEqual({ prompt: 'perro', answer: 'dog' });
  });
  it('prompts with the Back when answering with the Front', () => {
    expect(sides(card, 'front')).toEqual({ prompt: 'dog', answer: 'perro' });
  });
});

describe('isWrittenCorrect', () => {
  it('ignores case, accents, punctuation, and spacing', () => {
    expect(isWrittenCorrect('  brasilia ', 'Brasília')).toBe(true);
    expect(isWrittenCorrect('buenos   aires!', 'Buenos Aires')).toBe(true);
    expect(normalizeAnswer("It's  OK.")).toBe('it s ok');
  });
  it('rejects wrong or empty answers', () => {
    expect(isWrittenCorrect('Paris', 'Rome')).toBe(false);
    expect(isWrittenCorrect('', 'Rome')).toBe(false);
  });
  it('compares symbol-only answers literally', () => {
    expect(isWrittenCorrect('+', '+')).toBe(true);
    expect(isWrittenCorrect('-', '+')).toBe(false);
  });
});

describe('pickDistractors', () => {
  const deck = [
    mk('a', 'France', 'Paris'),
    mk('b', 'Japan', 'Tokyo'),
    mk('c', 'Egypt', 'Cairo'),
    mk('d', 'Argentina', 'Buenos Aires'),
    mk('e', 'Dupe', 'paris'), // same answer as card a, different case
    mk('f', 'Year', '1999'),
  ];

  it('returns distinct wrong answers from the same deck, never the correct one', () => {
    for (let seed = 1; seed < 30; seed++) {
      const d = pickDistractors(deck[0], deck, [], 'back', 3, seeded(seed));
      expect(d).toHaveLength(3);
      expect(new Set(d.map((x) => x.toLowerCase())).size).toBe(3);
      expect(d.map((x) => x.toLowerCase())).not.toContain('paris');
    }
  });

  it('prefers similar answers (words over numbers for a word answer)', () => {
    const d = pickDistractors(deck[0], deck, [], 'back', 3, seeded(7));
    expect(d).not.toContain('1999');
  });

  it('uses the answer side for the chosen direction', () => {
    const d = pickDistractors(deck[0], deck, [], 'front', 3, seeded(3));
    expect(d.every((x) => deck.some((c) => c.front === x))).toBe(true);
    expect(d).not.toContain('France');
  });

  it('falls back to other decks, then to fewer options', () => {
    const small = [mk('x', 'one', 'uno'), mk('y', 'two', 'dos')];
    const other = [mk('z', 'three', 'tres', 'd2')];
    expect(pickDistractors(small[0], small, other, 'back', 3, seeded())).toEqual(['dos', 'tres']);
    expect(pickDistractors(small[0], small, [], 'back', 3, seeded())).toEqual(['dos']);
    expect(buildChoices(mk('solo', 'a', 'b'), [], [], 'back')).toBeNull();
  });

  it('buildChoices puts the correct answer at correctIndex', () => {
    const q = buildChoices(deck[1], deck, [], 'back', seeded(5));
    expect(q.options).toHaveLength(4);
    expect(q.options[q.correctIndex]).toBe('Tokyo');
  });
});

describe('shuffle', () => {
  it('keeps the same items and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seeded(9));
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});
