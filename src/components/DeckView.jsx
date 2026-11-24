/**
 * DeckView.jsx — one deck: rename/delete it, add cards one at a time or via
 * Quick Import, and browse/edit/delete existing cards.
 */

import { useMemo, useState } from 'react';
import { useStore } from '../state/store.jsx';
import { countDue } from '../lib/queue.js';
import { formatDue } from '../lib/format.js';
import QuickImport from './QuickImport.jsx';
import DueCounts from './DueCounts.jsx';

const LIST_LIMIT = 200; // keeps the page fast for very large decks

export default function DeckView({ deckId, onBack, onStudy }) {
  const { state, renameDeck, deleteDeck, addCards, newRemaining } = useStore();
  const deck = state.decks.find((d) => d.id === deckId);
  const cards = useMemo(() => state.cards.filter((c) => c.deckId === deckId), [state.cards, deckId]);
  const due = useMemo(() => countDue(cards, newRemaining, Date.now()), [cards, newRemaining]);

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [filter, setFilter] = useState('');

  if (!deck) return null;

  const saveName = (e) => {
    e.preventDefault();
    if (draftName.trim()) renameDeck(deck.id, draftName);
    setRenaming(false);
  };

  const remove = () => {
    const n = cards.length;
    if (window.confirm(`Delete “${deck.name}” and its ${n} ${n === 1 ? 'card' : 'cards'}? This cannot be undone.`)) {
      deleteDeck(deck.id);
      onBack();
    }
  };

  const q = filter.trim().toLowerCase();
  const visible = q ? cards.filter((c) => `${c.front}\n${c.back}`.toLowerCase().includes(q)) : cards;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button className="btn-ghost -ml-3 mb-2" onClick={onBack}>
          ← All decks
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {renaming ? (
            <form onSubmit={saveName} className="flex flex-1 gap-2">
              <input
                className="input text-lg font-semibold"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setRenaming(false)}
                aria-label="Deck name"
                autoFocus
              />
              <button className="btn-primary">Save</button>
              <button type="button" className="btn-ghost" onClick={() => setRenaming(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">{deck.name}</h1>
          )}
          {!renaming && (
            <div className="flex items-center gap-1">
              <button
                className="btn-ghost"
                onClick={() => {
                  setDraftName(deck.name);
                  setRenaming(true);
                }}
              >
                Rename
              </button>
              <button className="btn-danger" onClick={remove}>
                Delete
              </button>
              <button className="btn-primary ml-1" disabled={!due.total} onClick={onStudy}>
                Study{due.total ? ` (${due.total})` : ''}
              </button>
            </div>
          )}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 text-sm text-zinc-500">
          <span>
            {cards.length} {cards.length === 1 ? 'card' : 'cards'}
          </span>
          <DueCounts counts={due} />
        </p>
      </div>

      <AddCardForm onAdd={(card) => addCards(deck.id, [card])} />

      <details className="panel group p-5" open={cards.length === 0}>
        <summary className="cursor-pointer select-none font-medium">Quick Import — paste many cards</summary>
        <div className="mt-4">
          <QuickImport onImport={(items) => addCards(deck.id, items)} />
        </div>
      </details>

      {/* Card list */}
      {cards.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Cards</h2>
            <input
              className="input max-w-56"
              placeholder="Search cards"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Search cards"
            />
          </div>
          <ul className="panel divide-y divide-zinc-200 dark:divide-zinc-800">
            {visible.slice(0, LIST_LIMIT).map((card) => (
              <CardRow key={card.id} card={card} />
            ))}
            {visible.length === 0 && <li className="p-5 text-center text-sm text-zinc-500">No matching cards.</li>}
          </ul>
          {visible.length > LIST_LIMIT && (
            <p className="text-center text-xs text-zinc-500">
              Showing {LIST_LIMIT} of {visible.length}. Use search to find others.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/** Two-field form for adding a single card. Ctrl/Cmd+Enter submits. */
function AddCardForm({ onAdd }) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const ok = front.trim() && back.trim();

  const submit = (e) => {
    e?.preventDefault();
    if (!ok) return;
    onAdd({ front, back });
    setFront('');
    setBack('');
    e?.target.closest?.('form')?.querySelector('textarea')?.focus();
  };
  const onKeyDown = (e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && submit(e);

  return (
    <form onSubmit={submit} className="panel space-y-3 p-5">
      <h2 className="font-medium">Add a card</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <textarea className="input min-h-20" placeholder="Front" value={front} onChange={(e) => setFront(e.target.value)} onKeyDown={onKeyDown} aria-label="Front" />
        <textarea className="input min-h-20" placeholder="Back" value={back} onChange={(e) => setBack(e.target.value)} onKeyDown={onKeyDown} aria-label="Back" />
      </div>
      <div className="flex items-center justify-end gap-3">
        <span className="hidden text-xs text-zinc-500 sm:inline">⌘/Ctrl + Enter</span>
        <button className="btn-primary" disabled={!ok}>
          Add card
        </button>
      </div>
    </form>
  );
}

const STATE_LABEL = {
  new: ['New', 'text-sky-600 dark:text-sky-400'],
  learning: ['Learning', 'text-orange-600 dark:text-orange-400'],
  relearning: ['Relearning', 'text-orange-600 dark:text-orange-400'],
  review: ['Review', 'text-emerald-600 dark:text-emerald-400'],
};

/** One card in the list, with inline editing. */
function CardRow({ card }) {
  const { updateCard, deleteCard } = useStore();
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [label, color] = STATE_LABEL[card.state];

  if (editing) {
    return (
      <li className="space-y-2 p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <textarea className="input" value={front} onChange={(e) => setFront(e.target.value)} aria-label="Front" autoFocus />
          <textarea className="input" value={back} onChange={(e) => setBack(e.target.value)} aria-label="Back" />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!front.trim() || !back.trim()}
            onClick={() => {
              updateCard(card.id, { front: front.trim(), back: back.trim() });
              setEditing(false);
            }}
          >
            Save
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-3 px-4 py-3 text-sm">
      <div className="grid min-w-0 flex-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
        <p className="truncate font-medium">{card.front}</p>
        <p className="truncate text-zinc-500 dark:text-zinc-400">{card.back}</p>
      </div>
      <span className={`hidden w-28 shrink-0 text-right text-xs sm:block ${color}`}>
        {label}
        {card.state !== 'new' && <span className="text-zinc-400"> · {formatDue(card.due)}</span>}
      </span>
      <div className="flex shrink-0 gap-1 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button
          className="btn-ghost px-2 py-1 text-xs"
          onClick={() => {
            setFront(card.front);
            setBack(card.back);
            setEditing(true);
          }}
        >
          Edit
        </button>
        <button className="btn-danger px-2 py-1 text-xs" onClick={() => deleteCard(card.id)} aria-label={`Delete card ${card.front}`}>
          Delete
        </button>
      </div>
    </li>
  );
}
