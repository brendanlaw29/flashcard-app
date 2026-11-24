/**
 * TestResults.jsx — score, per-question breakdown, and next actions
 * (Retake Missed Questions / New test / Back).
 */

import { describeCorrect, describeResponse } from '../lib/practiceTest.js';

export default function TestResults({ result, onRetakeMissed, onNewTest, onExit }) {
  const missed = result.total - result.correct;
  const tone =
    result.percent >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : result.percent >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div className="space-y-5">
      <section className="panel card-enter flex flex-col items-center gap-4 p-8 text-center">
        <p className="text-sm font-medium text-zinc-500">Your score</p>
        <p className={`text-6xl font-semibold tabular-nums ${tone}`}>{result.percent}%</p>
        <p className="text-zinc-500 dark:text-zinc-400">
          {result.correct} of {result.total} correct
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {missed > 0 && (
            <button className="btn-primary" onClick={onRetakeMissed}>
              Retake Missed Questions ({missed})
            </button>
          )}
          <button className="btn-secondary" onClick={onNewTest}>
            New test
          </button>
          <button className="btn-ghost" onClick={onExit}>
            Back to deck
          </button>
        </div>
      </section>

      <ol className="panel divide-y divide-zinc-200 dark:divide-zinc-800">
        {result.results.map(({ question: q, response, correct }, i) => (
          <li key={q.id} className="flex gap-3 px-5 py-4 text-sm">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs text-white ${
                correct ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              aria-label={correct ? 'Correct' : 'Incorrect'}
            >
              {correct ? '✓' : '✗'}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium">
                <span className="text-zinc-400">{i + 1}. </span>
                <span className="whitespace-pre-wrap break-words">{q.prompt}</span>
                {q.type === 'tf' && <span className="text-zinc-500"> → “{q.statement}”?</span>}
              </p>
              <p className={correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                <span className="text-zinc-500">Your answer: </span>
                {describeResponse(q, response)}
              </p>
              {!correct && (
                <p>
                  <span className="text-zinc-500">Correct: </span>
                  <span className="font-medium">{describeCorrect(q)}</span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
