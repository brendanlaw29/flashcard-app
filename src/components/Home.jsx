/**
 * Home.jsx — the "Cards Due Today" counter, deck list, and new-deck form.
 */

import { useMemo, useState } from 'react';
import { useStore } from '../state/store.jsx';
import { countDue } from '../lib/queue.js';
import DueCounts from './DueCounts.jsx';

export default function Home({ onOpenDeck, onStudy }) {
  const { state, addDeck, newRemaining } = useStore();
  const [name, setName] = useState('');

  // Per-deck card lists and due counts, recomputed only when data changes.
  const decks = useMemo(() => {
    const now = Date.now();
    return state.decks.map((deck) => {
      const cards = state.cards.filter((c) => c.deckId === deck.id);
      return { ...deck, total: cards.length, due: countDue(cards, newRemaining, now) };
    });
  }, [state, newRemaining]);

  const totals = decks.reduce(
    (t, d) => ({
      new: t.new + d.due.new,
      learning: t.learning + d.due.learning,
      review: t.review + d.due.review,
      total: t.total + d.due.total,
    }),
    { new: 0, learning: 0, review: 0, total: 0 },
  );

  const create = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onOpenDeck(addDeck(name));
    setName('');
  };

  return (
    <div className="space-y-6">
      {/* Daily counter */}
      <section className="panel flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Cards due today</p>
          <p className="mt-1 text-6xl font-semibold tracking-tight tabular-nums">{totals.total}</p>
          <DueCounts counts={totals} className="mt-3" />
        </div>
        <button className="btn-primary px-5 py-3 text-base" disabled={!totals.total} onClick={() => onStudy(null)}>
          {totals.total ? 'Study all due cards' : 'All caught up'}
        </button>
      </section>

      {/* Deck list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Decks</h2>

        {decks.length === 0 ? (
          <p className="panel p-8 text-center text-sm text-zinc-500">
            No decks yet. Create one below, then paste in some cards.
          </p>
        ) : (
          <ul className="panel divide-y divide-zinc-200 dark:divide-zinc-800">
            {decks.map((deck) => (
              <li key={deck.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <button onClick={() => onOpenDeck(deck.id)} className="min-w-0 flex-1 cursor-pointer text-left">
                  <span className="block truncate font-medium hover:text-indigo-600 dark:hover:text-indigo-400">
                    {deck.name}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {deck.total} {deck.total === 1 ? 'card' : 'cards'}
                  </span>
                </button>
                {/* Wrapper hides the counts on phones (DueCounts sets its own display class). */}
                <span className="hidden sm:inline-flex">
                  <DueCounts counts={deck.due} />
                </span>
                <button className="btn-secondary" disabled={!deck.due.total} onClick={() => onStudy(deck.id)}>
                  Study{deck.due.total ? ` (${deck.due.total})` : ''}
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={create} className="mt-3 flex gap-2">
          <input
            className="input"
            placeholder="New deck name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="New deck name"
          />
          <button className="btn-primary shrink-0" disabled={!name.trim()}>
            Create deck
          </button>
        </form>
      </section>
    </div>
  );
}
