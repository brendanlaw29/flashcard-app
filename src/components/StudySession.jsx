/**
 * StudySession.jsx — the study loop for one deck (or all decks).
 *
 * Shows one card at a time: flip it (Space), then rate it (1–4). Learning
 * cards rated with short steps (1m, 10m) come back in the same session.
 */

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store.jsx';
import { schedule, GOOD } from '../lib/scheduler.js';
import { countDue, nextCard, nextLearningLater } from '../lib/queue.js';
import { formatInterval } from '../lib/format.js';
import FlipCard from './FlipCard.jsx';
import RatingButtons from './RatingButtons.jsx';
import DueCounts from './DueCounts.jsx';

export default function StudySession({ deckId, onExit }) {
  const { state, reviewCard, newRemaining } = useStore();
  const [now, setNow] = useState(Date.now);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  // The card on screen is pinned by id, so it never changes while you look at it.
  const [currentId, setCurrentId] = useState(null);

  // Re-check the clock every 10s so learning cards come back when due.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const scope = useMemo(
    () => (deckId ? state.cards.filter((c) => c.deckId === deckId) : state.cards),
    [state.cards, deckId],
  );
  const card = scope.find((c) => c.id === currentId) ?? nextCard(scope, newRemaining, now);
  const counts = countDue(scope, newRemaining, now);

  useEffect(() => {
    if (card && card.id !== currentId) setCurrentId(card.id);
  }, [card, currentId]);

  const flip = () => setFlipped(true);
  const rate = (rating) => {
    if (!card || !flipped) return;
    const t = Date.now();
    reviewCard(card, schedule(card, rating, t));
    setReviewed((n) => n + 1);
    setFlipped(false);
    setCurrentId(null); // pick the next card on the next render
    setNow(t);
  };

  // Keyboard shortcuts: Space/Enter flip (or Good once flipped), 1–4 rate, Esc exits.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      // Blur any focused button so Space doesn't also "click" it.
      if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
      if (e.key === 'Escape') return onExit();
      if (!card) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        return flipped ? rate(GOOD) : flip();
      }
      if (flipped && ['1', '2', '3', '4'].includes(e.key)) rate(Number(e.key));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const deckName = deckId ? state.decks.find((d) => d.id === deckId)?.name : 'All decks';

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button className="btn-ghost -ml-3" onClick={onExit}>
          ← {deckName} <span className="kbd ml-1 hidden sm:inline">Esc</span>
        </button>
        {card && <DueCounts counts={counts} />}
      </div>

      {card ? (
        <>
          {/* key forces a fresh, unflipped card (no reverse animation revealing the next answer) */}
          <FlipCard key={`${card.id}-${reviewed}`} front={card.front} back={card.back} flipped={flipped} onFlip={flip} />
          <div className="min-h-24">
            {flipped ? (
              <RatingButtons card={card} now={now} onRate={rate} />
            ) : (
              <button className="btn-primary w-full py-4 text-base" onClick={flip}>
                Show answer <span className="kbd border-white/40">Space</span>
              </button>
            )}
          </div>
        </>
      ) : (
        <Finished reviewed={reviewed} later={nextLearningLater(scope, now)} now={now} onExit={onExit} />
      )}
    </div>
  );
}

/** Shown when nothing is left to study right now. */
function Finished({ reviewed, later, now, onExit }) {
  return (
    <div className="panel card-enter p-10 text-center">
      <p className="text-2xl font-semibold">{later ? 'Nice work — short break' : 'Congratulations!'}</p>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        {reviewed > 0
          ? `You reviewed ${reviewed} ${reviewed === 1 ? 'card' : 'cards'} this session.`
          : 'There are no cards due right now.'}
      </p>
      {later ? (
        <p className="mt-2 text-sm text-zinc-500">
          A learning card is due in {formatInterval(later.due - now)}. Keep this tab open and it will appear automatically.
        </p>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">You're done for today.</p>
      )}
      <button className="btn-primary mt-6" onClick={onExit}>
        Back
      </button>
    </div>
  );
}
