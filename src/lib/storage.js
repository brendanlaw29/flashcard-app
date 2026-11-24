/**
 * storage.js — loads/saves app data in localStorage and handles JSON
 * backup files (export, validate, import).
 *
 * Everything lives under one versioned key so the format can be migrated later.
 */

import { newCardFields } from './scheduler.js';
import { sampleData } from './sampleDeck.js';

export const STORAGE_KEY = 'flashcards.v1';
export const DATA_VERSION = 1;

/** Short random id like "d_k3j9x2ab". */
export function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/** Default settings for a fresh install. */
export const defaultSettings = { theme: 'system', newCardsPerDay: 20 };

/** Empty data shell. */
export function emptyData() {
  return { version: DATA_VERSION, settings: { ...defaultSettings }, decks: [], cards: [], newCardsStudied: {} };
}

/**
 * Load saved data. On first run (nothing saved yet) returns the sample deck.
 * If saved data is corrupt, returns sample data and reports the error.
 * @returns {{data: object, error: string | null}}
 */
export function loadData() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { data: sampleData(), error: 'Browser storage is unavailable. Changes will not be saved.' };
  }
  if (raw == null) return { data: sampleData(), error: null };

  try {
    return { data: validateData(JSON.parse(raw)), error: null };
  } catch (e) {
    // Keep the corrupt copy so nothing is lost permanently.
    try {
      localStorage.setItem(`${STORAGE_KEY}.corrupt-${Date.now()}`, raw);
    } catch {
      /* ignore */
    }
    return { data: sampleData(), error: `Saved data could not be read (${e.message}). A copy was kept.` };
  }
}

/** Save data. Returns an error message if storage is full/unavailable, else null. */
export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return null;
  } catch {
    return 'Could not save to browser storage (it may be full). Export a backup now.';
  }
}

/**
 * Check that an object looks like our data format and fill in any missing
 * fields with defaults. Throws an Error with a readable message if invalid.
 */
export function validateData(input) {
  if (!input || typeof input !== 'object') throw new Error('File is not a flashcard backup.');
  if (!Array.isArray(input.decks) || !Array.isArray(input.cards)) {
    throw new Error('Backup is missing "decks" or "cards".');
  }
  if (typeof input.version === 'number' && input.version > DATA_VERSION) {
    throw new Error(`Backup is from a newer app version (${input.version}).`);
  }

  const isStr = (v) => typeof v === 'string';
  const decks = input.decks
    .filter((d) => d && isStr(d.id) && isStr(d.name))
    .map((d) => ({ id: d.id, name: d.name, createdAt: Number(d.createdAt) || Date.now() }));
  const deckIds = new Set(decks.map((d) => d.id));

  const cards = input.cards
    .filter((c) => c && isStr(c.id) && deckIds.has(c.deckId) && isStr(c.front) && isStr(c.back))
    .map((c) => normalizeCard(c));

  return {
    version: DATA_VERSION,
    settings: { ...defaultSettings, ...(input.settings || {}) },
    decks,
    cards,
    newCardsStudied: input.newCardsStudied && typeof input.newCardsStudied === 'object' ? input.newCardsStudied : {},
  };
}

/** Fill missing/invalid scheduling fields on a card with defaults. */
function normalizeCard(c) {
  const defaults = newCardFields(Number(c.createdAt) || Date.now());
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  const states = ['new', 'learning', 'review', 'relearning'];
  return {
    id: c.id,
    deckId: c.deckId,
    front: c.front,
    back: c.back,
    createdAt: num(c.createdAt, Date.now()),
    state: states.includes(c.state) ? c.state : 'new',
    due: num(c.due, defaults.due),
    interval: num(c.interval, 0),
    ease: num(c.ease, defaults.ease),
    step: num(c.step, 0),
    reps: num(c.reps, 0),
    lapses: num(c.lapses, 0),
  };
}

/** Merge a backup into current data, adding only decks/cards with new ids. */
export function mergeData(current, incoming) {
  const deckIds = new Set(current.decks.map((d) => d.id));
  const cardIds = new Set(current.cards.map((c) => c.id));
  const decks = [...current.decks, ...incoming.decks.filter((d) => !deckIds.has(d.id))];
  const allDeckIds = new Set(decks.map((d) => d.id));
  const cards = [...current.cards, ...incoming.cards.filter((c) => !cardIds.has(c.id) && allDeckIds.has(c.deckId))];
  return { ...current, decks, cards };
}

/** Trigger a browser download of the data as flashcards-backup-YYYY-MM-DD.json. */
export function downloadBackup(data, dateKey) {
  const payload = { ...data, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flashcards-backup-${dateKey}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
