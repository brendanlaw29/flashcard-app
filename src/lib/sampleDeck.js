/**
 * sampleDeck.js — starter content shown on first launch so the app isn't empty.
 * Delete the deck any time; it won't come back (it only loads when no data is saved).
 */

import { newCardFields } from './scheduler.js';
import { defaultSettings, DATA_VERSION } from './storage.js';

const CAPITALS = [
  ['France', 'Paris'],
  ['Japan', 'Tokyo'],
  ['Brazil', 'Brasília'],
  ['Canada', 'Ottawa'],
  ['Australia', 'Canberra'],
  ['Egypt', 'Cairo'],
  ['Kenya', 'Nairobi'],
  ['Germany', 'Berlin'],
  ['Argentina', 'Buenos Aires'],
  ['South Korea', 'Seoul'],
  ['New Zealand', 'Wellington'],
  ['Turkey', 'Ankara'],
  ['Morocco', 'Rabat'],
  ['Vietnam', 'Hanoi'],
  ['Norway', 'Oslo'],
];

export function sampleData(now = Date.now()) {
  const deckId = 'd_sample';
  return {
    version: DATA_VERSION,
    settings: { ...defaultSettings },
    decks: [{ id: deckId, name: 'Sample: World Capitals', createdAt: now }],
    cards: CAPITALS.map(([country, capital], i) => ({
      id: `c_sample${i}`,
      deckId,
      front: `What is the capital of ${country}?`,
      back: capital,
      ...newCardFields(now),
      createdAt: now + i, // keeps the list order stable
    })),
    newCardsStudied: {},
  };
}
