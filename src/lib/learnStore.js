/**
 * learnStore.js — saves Learn-mode progress per deck and direction under its
 * own localStorage key. It is kept out of the main data (and out of backups)
 * so the v1 backup format is unchanged.
 */

const KEY = 'flashcards.learn.v1';

const slot = (deckId, answerWith) => `${deckId}:${answerWith}`;

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function writeAll(all) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* Learn progress is optional; ignore storage errors. */
  }
}

/** Saved Learn session for a deck + direction, or null. */
export function loadLearn(deckId, answerWith) {
  const saved = readAll()[slot(deckId, answerWith)];
  return saved && Array.isArray(saved.order) && saved.progress && Array.isArray(saved.queue) ? saved : null;
}

/** Save (or with `null`, clear) a Learn session. */
export function saveLearn(deckId, answerWith, state) {
  const all = readAll();
  if (state) all[slot(deckId, answerWith)] = state;
  else delete all[slot(deckId, answerWith)];
  writeAll(all);
}
