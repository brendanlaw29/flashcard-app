/**
 * LearnMode.jsx — adaptive Learn mode for one deck.
 *
 * Screens: start (direction + resume) → question ⇄ feedback → round summary
 * → … → done. The rules (levels, rounds, re-queueing) live in lib/learn.js;
 * this file only handles the UI. Progress is saved after every answer.
 */

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store.jsx';
import {
  createLearnSession, syncLearnSession, startRound, currentCardId, questionType, answerCard,
  learnCounts, isRoundOver, isLearnComplete,
} from '../lib/learn.js';
import { loadLearn, saveLearn } from '../lib/learnStore.js';
import { sides, buildChoices, isWrittenCorrect } from '../lib/quiz.js';
import { DirectionToggle } from './Segmented.jsx';
import ProgressBar from './ProgressBar.jsx';
import Choice from './Choice.jsx';

export default function LearnMode({ deckId, onExit }) {
  const { state, setDeckAnswerWith } = useStore();
  const deck = state.decks.find((d) => d.id === deckId);
  const deckCards = useMemo(() => state.cards.filter((c) => c.deckId === deckId), [state.cards, deckId]);
  const otherCards = useMemo(() => state.cards.filter((c) => c.deckId !== deckId), [state.cards, deckId]);
  const answerWith = deck?.answerWith ?? 'back';

  const [session, setSession] = useState(null); // null = start screen
  const [phase, setPhase] = useState('question'); // 'question' | 'summary' | 'done'
  // After an answer: { question, correct, chosen?, given?, prev } (prev = session before answering, for Override)
  const [feedback, setFeedback] = useState(null);

  // Save progress whenever the session changes.
  useEffect(() => {
    if (session) saveLearn(deckId, session.answerWith, session);
  }, [session, deckId]);

  const saved = useMemo(() => (session ? null : loadLearn(deckId, answerWith)), [session, deckId, answerWith]);
  const savedSynced = saved && syncLearnSession(saved, deckCards.map((c) => c.id));

  /** Start (or resume) a session. */
  const begin = (restart = false) => {
    const ids = deckCards.map((c) => c.id);
    let s = !restart && savedSynced ? savedSynced : createLearnSession(ids, answerWith);
    if (isLearnComplete(s)) {
      setSession(s);
      return setPhase('done');
    }
    if (isRoundOver(s)) s = startRound(s);
    setFeedback(null);
    setSession(s);
    setPhase('question');
  };

  // The question on screen. Options are rebuilt only when a new question starts.
  const cardId = session && currentCardId(session);
  const question = useMemo(() => {
    const card = deckCards.find((c) => c.id === cardId);
    if (!card) return null;
    const choices = buildChoices(card, deckCards, otherCards, session.answerWith);
    return { card, ...sides(card, session.answerWith), type: questionType(session, card.id, !!choices), choices };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, session?.round, session?.roundAnswered]);
  const shown = feedback?.question ?? question;

  /** Record an answer and show feedback. */
  const submit = (correct, extra) => {
    setFeedback({ question, correct, prev: session, ...extra });
    setSession(answerCard(session, correct));
  };

  /** Move on after feedback: next question, round summary, or done. */
  const advance = (s = session) => {
    setFeedback(null);
    if (isLearnComplete(s)) setPhase('done');
    else if (isRoundOver(s)) setPhase('summary');
  };

  /** "Override: I was right" — redo the answer as correct. */
  const override = () => {
    const s = answerCard(feedback.prev, true);
    setSession(s);
    advance(s);
  };

  const nextRound = () => {
    setSession(startRound(session));
    setPhase('question');
  };

  // Correct answers move on automatically after a short pause.
  useEffect(() => {
    if (!feedback?.correct) return;
    const t = setTimeout(() => advance(session), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback, session]);

  // Keyboard: 1–4 pick an option, Enter continues, Esc exits.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const typing = e.target instanceof HTMLInputElement;
      if (e.key === 'Escape') return onExit();
      if (!session) return;
      if (e.key === 'Enter' && !typing) {
        if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
        if (phase === 'summary') return e.preventDefault(), nextRound();
        if (feedback && (feedback.correct || shown?.type === 'mc')) return e.preventDefault(), advance();
      }
      if (!typing && !feedback && phase === 'question' && shown?.type === 'mc') {
        const i = Number(e.key) - 1;
        if (i >= 0 && i < shown.choices.options.length) submit(i === shown.choices.correctIndex, { chosen: i });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!deck) return null;
  const back = (
    <button className="btn-ghost -ml-3" onClick={onExit}>
      ← {deck.name} <span className="kbd ml-1 hidden sm:inline">Esc</span>
    </button>
  );

  // ---- Start screen ----
  if (!session) {
    const counts = savedSynced && learnCounts(savedSynced);
    const started = counts && (counts.familiar || counts.mastered || savedSynced.round > 0);
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        {back}
        <div className="panel space-y-5 p-6 sm:p-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Learn</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Work through the deck in short rounds. Each card starts as multiple choice, then you type the
              answer in a later round to master it.
            </p>
          </div>
          <DirectionToggle value={answerWith} onChange={(v) => setDeckAnswerWith(deck.id, v)} />
          {started && <ProgressBar counts={counts} />}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!deckCards.length} onClick={() => begin(false)}>
              {started ? 'Continue' : 'Start Learn'}
            </button>
            {started && (
              <button className="btn-ghost" onClick={() => begin(true)}>
                Start over
              </button>
            )}
          </div>
          {!deckCards.length && <p className="text-sm text-zinc-500">Add some cards to this deck first.</p>}
        </div>
      </div>
    );
  }

  const counts = learnCounts(session);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        {back}
        <span className="text-xs text-zinc-500">
          {phase === 'done' ? 'Complete' : `Round ${session.round}`} · Answer with {session.answerWith === 'front' ? 'Front' : 'Back'}
        </span>
      </div>
      <ProgressBar counts={counts} />

      {phase === 'done' && (
        <div className="panel card-enter p-10 text-center">
          <p className="text-2xl font-semibold">All {counts.total} cards mastered!</p>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">Nice work. Learn again any time to refresh.</p>
          <div className="mt-6 flex justify-center gap-2">
            <button className="btn-secondary" onClick={() => begin(true)}>
              Learn again
            </button>
            <button className="btn-primary" onClick={onExit}>
              Back to deck
            </button>
          </div>
        </div>
      )}

      {phase === 'summary' && (
        <div className="panel card-enter p-10 text-center">
          <p className="text-2xl font-semibold">Round {session.round} complete</p>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            {session.roundCorrect} of {session.roundAnswered} answers correct · {counts.mastered} of {counts.total} mastered
          </p>
          <button className="btn-primary mt-6" onClick={nextRound} autoFocus>
            Continue to round {session.round + 1} <span className="kbd border-white/40">Enter</span>
          </button>
        </div>
      )}

      {phase === 'question' && shown && (
        <div key={`${shown.card.id}-${session.round}-${feedback?.prev.roundAnswered ?? session.roundAnswered}`} className="card-enter space-y-4">
          <div className="panel p-6 sm:p-8">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              {session.answerWith === 'front' ? 'Back' : 'Front'}
              {shown.type === 'written' && ' · type the answer'}
            </p>
            <p className="mt-3 whitespace-pre-wrap break-words text-2xl leading-snug sm:text-3xl">{shown.prompt}</p>
          </div>

          {shown.type === 'mc' ? (
            <MultipleChoice question={shown} feedback={feedback} onChoose={(i) => submit(i === shown.choices.correctIndex, { chosen: i })} />
          ) : feedback ? (
            <WrittenFeedback question={shown} feedback={feedback} onContinue={() => advance()} onOverride={override} />
          ) : (
            <WrittenPrompt onSubmit={(text) => submit(isWrittenCorrect(text, shown.answer), { given: text })} />
          )}

          {feedback && <FeedbackBar feedback={feedback} type={shown.type} onContinue={() => advance()} />}
        </div>
      )}
    </div>
  );
}

/** 2×2 grid of options; after answering, shows the right (and chosen wrong) option. */
function MultipleChoice({ question, feedback, onChoose }) {
  const { options, correctIndex } = question.choices;
  const stateOf = (i) => {
    if (!feedback) return 'idle';
    if (i === correctIndex) return 'correct';
    if (i === feedback.chosen) return 'wrong';
    return 'dim';
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((opt, i) => (
        <Choice key={i} label={opt} shortcut={i + 1} state={stateOf(i)} disabled={!!feedback} onClick={() => onChoose(i)} />
      ))}
    </div>
  );
}

/** Text box for a written answer. */
function WrittenPrompt({ onSubmit }) {
  const [text, setText] = useState('');
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSubmit(text);
      }}
    >
      <input
        className="input py-3 text-base"
        placeholder="Type your answer"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Your answer"
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => onSubmit('')}>
          Don't know
        </button>
        <button className="btn-primary" disabled={!text.trim()}>
          Answer <span className="kbd border-white/40">Enter</span>
        </button>
      </div>
    </form>
  );
}

/**
 * After a written answer: shows your answer vs. the correct one. If wrong,
 * you must re-type the correct answer to continue (or override a typo).
 */
function WrittenFeedback({ question, feedback, onContinue, onOverride }) {
  const [retype, setRetype] = useState('');
  const retyped = isWrittenCorrect(retype, question.answer);

  if (feedback.correct) {
    return (
      <div className="panel space-y-1 p-4 text-sm">
        <p>
          <span className="text-zinc-500">Your answer: </span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">{feedback.given}</span>
        </p>
        {feedback.given.trim() !== question.answer.trim() && (
          <p>
            <span className="text-zinc-500">Exact answer: </span>
            {question.answer}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="panel space-y-4 p-5">
      <div className="space-y-1 text-sm">
        <p>
          <span className="text-zinc-500">Your answer: </span>
          <span className="font-medium text-red-600 line-through decoration-1 dark:text-red-400">
            {feedback.given || 'Don’t know'}
          </span>
        </p>
        <p>
          <span className="text-zinc-500">Correct answer: </span>
          <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{question.answer}</span>
        </p>
      </div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (retyped) onContinue();
        }}
      >
        <input
          className="input"
          placeholder="Type the correct answer to continue"
          value={retype}
          onChange={(e) => setRetype(e.target.value)}
          aria-label="Re-type the correct answer"
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <div className="flex flex-wrap justify-end gap-2">
          {feedback.given && (
            <button type="button" className="btn-ghost" onClick={onOverride}>
              Override: I was right
            </button>
          )}
          <button className="btn-primary" disabled={!retyped}>
            Continue <span className="kbd border-white/40">Enter</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/** Right/wrong banner; for wrong multiple choice it holds the Continue button. */
function FeedbackBar({ feedback, type, onContinue }) {
  if (feedback.correct) {
    return <p className="text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">Correct!</p>;
  }
  if (type !== 'mc') return null; // the written feedback panel has its own controls
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm dark:bg-red-950/40">
      <span className="font-medium text-red-700 dark:text-red-300">Not quite. It'll come back in a moment.</span>
      <button className="btn-primary" onClick={onContinue} autoFocus>
        Continue <span className="kbd border-white/40">Enter</span>
      </button>
    </div>
  );
}
