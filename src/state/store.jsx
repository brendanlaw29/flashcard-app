/**
 * store.jsx — app state (decks, cards, settings) in a React reducer,
 * shared through Context and auto-saved to localStorage.
 *
 * Components call `useStore()` to read state and get the action helpers.
 * Anything random or time-based (ids, timestamps, fuzz) is computed in the
 * helpers, so the reducer stays pure.
 */

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { loadData, saveData, mergeData, uid } from '../lib/storage.js';
import { newCardFields } from '../lib/scheduler.js';
import { dayKey } from '../lib/time.js';

const StoreContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case 'addDeck':
      return { ...state, decks: [...state.decks, action.deck] };

    case 'updateDeck':
      return { ...state, decks: state.decks.map((d) => (d.id === action.id ? { ...d, ...action.fields } : d)) };

    case 'deleteDeck':
      return {
        ...state,
        decks: state.decks.filter((d) => d.id !== action.id),
        cards: state.cards.filter((c) => c.deckId !== action.id),
      };

    case 'addCards':
      return { ...state, cards: [...state.cards, ...action.cards] };

    case 'updateCard':
      return { ...state, cards: state.cards.map((c) => (c.id === action.id ? { ...c, ...action.fields } : c)) };

    case 'deleteCard':
      return { ...state, cards: state.cards.filter((c) => c.id !== action.id) };

    case 'reviewCard': {
      // Save the new schedule; if the card was new, count it toward today's limit.
      const cards = state.cards.map((c) => (c.id === action.id ? { ...c, ...action.fields } : c));
      if (!action.wasNew) return { ...state, cards };
      const today = state.newCardsStudied[action.day] || {};
      return {
        ...state,
        cards,
        // Only today's counts matter, so older days are dropped.
        newCardsStudied: { [action.day]: { ...today, [action.deckId]: (today[action.deckId] || 0) + 1 } },
      };
    }

    case 'replaceAll':
      return action.data;

    case 'merge':
      return mergeData(state, action.data);

    case 'setSetting':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } };

    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

export function StoreProvider({ children }) {
  const [initial] = useState(loadData);
  const [state, dispatch] = useReducer(reducer, initial.data);
  const [error, setError] = useState(initial.error);

  // Save shortly after each change (debounced so typing/rating stays fast).
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
    const t = setTimeout(() => {
      const err = saveData(state);
      if (err) setError(err);
    }, 300);
    return () => clearTimeout(t);
  }, [state]);

  // Flush any pending save when the tab is closed or hidden.
  useEffect(() => {
    const flush = () => saveData(latest.current);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const value = useMemo(() => {
    /** New cards a deck may still introduce today. */
    const newRemaining = (deckId) =>
      state.settings.newCardsPerDay - (state.newCardsStudied[dayKey(Date.now())]?.[deckId] || 0);

    return {
      state,
      error,
      dismissError: () => setError(null),
      newRemaining,

      addDeck(name) {
        const deck = { id: uid('d'), name: name.trim(), createdAt: Date.now(), answerWith: 'back' };
        dispatch({ type: 'addDeck', deck });
        return deck.id;
      },
      renameDeck: (id, name) => dispatch({ type: 'updateDeck', id, fields: { name: name.trim() } }),
      /** Set a deck's study direction: 'back' (prompt shows Front) or 'front' (prompt shows Back). */
      setDeckAnswerWith: (id, answerWith) => dispatch({ type: 'updateDeck', id, fields: { answerWith } }),
      deleteDeck: (id) => dispatch({ type: 'deleteDeck', id }),

      /** Add cards ({front, back}[]) to a deck as new cards. */
      addCards(deckId, items) {
        const now = Date.now();
        const cards = items.map((item, i) => ({
          id: uid('c'),
          deckId,
          front: item.front.trim(),
          back: item.back.trim(),
          ...newCardFields(now),
          createdAt: now + i, // keeps paste order for new-card ordering
        }));
        dispatch({ type: 'addCards', cards });
      },
      updateCard: (id, fields) => dispatch({ type: 'updateCard', id, fields }),
      deleteCard: (id) => dispatch({ type: 'deleteCard', id }),

      /** Store a card's new schedule after rating it. */
      reviewCard(card, fields) {
        dispatch({
          type: 'reviewCard',
          id: card.id,
          fields,
          wasNew: card.state === 'new',
          deckId: card.deckId,
          day: dayKey(Date.now()),
        });
      },

      replaceAll: (data) => dispatch({ type: 'replaceAll', data }),
      mergeData: (data) => dispatch({ type: 'merge', data }),
      setSetting: (key, value) => dispatch({ type: 'setSetting', key, value }),
    };
  }, [state, error]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/** Access app state and actions from any component. */
export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
