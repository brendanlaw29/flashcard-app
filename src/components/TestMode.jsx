/**
 * TestMode.jsx — Practice Test controller: setup → taking → results.
 * Building and grading live in lib/practiceTest.js.
 */

import { useMemo, useState } from 'react';
import { useStore } from '../state/store.jsx';
import { buildTest, gradeTest, isAnswered } from '../lib/practiceTest.js';
import TestSetup from './TestSetup.jsx';
import TestQuestion from './TestQuestion.jsx';
import TestResults from './TestResults.jsx';

export default function TestMode({ deckId, onExit }) {
  const { state, setDeckAnswerWith } = useStore();
  const deck = state.decks.find((d) => d.id === deckId);
  const deckCards = useMemo(() => state.cards.filter((c) => c.deckId === deckId), [state.cards, deckId]);
  const otherCards = useMemo(() => state.cards.filter((c) => c.deckId !== deckId), [state.cards, deckId]);

  const [config, setConfig] = useState(() => ({
    count: Math.min(20, deckCards.length),
    types: ['mc', 'written', 'tf'],
    feedback: 'instant',
  }));
  const [phase, setPhase] = useState('setup'); // 'setup' | 'taking' | 'results'
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState({});
  const [locked, setLocked] = useState({}); // Instant mode: question id → true once answered
  const [result, setResult] = useState(null);

  if (!deck) return null;
  const answerWith = deck.answerWith;
  const instant = config.feedback === 'instant';

  /** Start a test from `cards` (the whole deck, or just the missed cards for a retake). */
  const start = (cards, count) => {
    setQuestions(buildTest({ cards, deckCards, otherCards, count, answerWith, types: config.types }));
    setResponses({});
    setLocked({});
    setResult(null);
    setPhase('taking');
    window.scrollTo(0, 0);
  };

  const respond = (qid, value, lock = false) => {
    if (locked[qid]) return;
    setResponses((r) => ({ ...r, [qid]: value }));
    if (lock) setLocked((l) => ({ ...l, [qid]: true }));
  };

  const answered = questions.filter((q) => isAnswered(q, responses[q.id])).length;

  const submit = () => {
    const unanswered = questions.length - answered;
    if (unanswered > 0 && !window.confirm(`${unanswered} unanswered question${unanswered === 1 ? '' : 's'} will be marked wrong. Submit anyway?`)) return;
    setResult(gradeTest(questions, responses));
    setPhase('results');
    window.scrollTo(0, 0);
  };

  const retakeMissed = () => {
    const missed = new Set(result.missedCardIds);
    start(deckCards.filter((c) => missed.has(c.id)), missed.size);
  };

  // Running score in Instant mode.
  const liveCorrect = instant ? gradeTest(questions.filter((q) => locked[q.id]), responses).correct : 0;
  const lockedCount = Object.keys(locked).length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button className="btn-ghost -ml-3" onClick={phase === 'taking' ? () => window.confirm('Leave this test? Your answers will be lost.') && onExit() : onExit}>
          ← {deck.name}
        </button>
        {phase === 'taking' && (
          <span className="text-xs tabular-nums text-zinc-500">
            {instant ? `${liveCorrect} / ${lockedCount} correct · ` : ''}
            {answered} of {questions.length} answered
          </span>
        )}
      </div>

      {phase === 'setup' && (
        <TestSetup
          deckSize={deckCards.length}
          config={{ ...config, answerWith }}
          onChange={({ answerWith: _ignored, ...rest }) => setConfig(rest)}
          onDirectionChange={(v) => setDeckAnswerWith(deck.id, v)}
          onStart={() => start(deckCards, config.count)}
        />
      )}

      {phase === 'taking' && (
        <>
          <div className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(answered / questions.length) * 100}%` }} />
          </div>
          {questions.map((q, i) => (
            <TestQuestion
              key={q.id}
              q={q}
              number={i + 1}
              total={questions.length}
              response={responses[q.id]}
              locked={!!locked[q.id]}
              reveal={instant && !!locked[q.id]}
              instant={instant}
              onRespond={(value, lock) => respond(q.id, value, lock)}
            />
          ))}
          <button className="btn-primary w-full py-3 text-base" onClick={submit}>
            {instant ? 'Finish test' : 'Submit Test'}
          </button>
        </>
      )}

      {phase === 'results' && (
        <TestResults
          result={result}
          onRetakeMissed={retakeMissed}
          onNewTest={() => setPhase('setup')}
          onExit={onExit}
        />
      )}
    </div>
  );
}
