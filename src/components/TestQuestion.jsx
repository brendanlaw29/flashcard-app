/**
 * TestQuestion.jsx — one Practice Test question (multiple choice,
 * true/false, or written). In Instant mode, an answer locks the question
 * and `reveal` shows right/wrong straight away.
 */

import { useState } from 'react';
import Choice from './Choice.jsx';
import { gradeQuestion } from '../lib/practiceTest.js';

const TYPE_LABEL = { mc: 'Multiple choice', tf: 'True or false', written: 'Written' };

/**
 * @param {object}   q          Question from buildTest().
 * @param {number}   number     1-based position.
 * @param {number}   total
 * @param {any}      response   Current response.
 * @param {boolean}  locked     Answer can no longer change.
 * @param {boolean}  reveal     Show right/wrong (Instant mode, once locked).
 * @param {(value: any, lock?: boolean) => void} onRespond
 * @param {boolean}  instant    Instant-feedback mode (choices lock on click).
 */
export default function TestQuestion({ q, number, total, response, locked, reveal, onRespond, instant }) {
  const correct = reveal && gradeQuestion(q, response);

  return (
    <article className="panel space-y-4 p-5 sm:p-6" aria-label={`Question ${number}`}>
      <header className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          {number} / {total} · {TYPE_LABEL[q.type]}
        </span>
        {reveal && (
          <span className={`font-semibold ${correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {correct ? '✓ Correct' : '✗ Incorrect'}
          </span>
        )}
      </header>

      <p className="whitespace-pre-wrap break-words text-xl leading-snug">{q.prompt}</p>

      {q.type === 'mc' && (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map((opt, i) => (
            <Choice
              key={i}
              label={opt}
              state={choiceState(i === q.correctIndex, i === response, reveal)}
              disabled={locked}
              onClick={() => onRespond(i, instant)}
            />
          ))}
        </div>
      )}

      {q.type === 'tf' && (
        <>
          <p className="rounded-lg bg-zinc-100 px-4 py-3 text-lg dark:bg-zinc-800/60">
            <span className="mr-2 text-xs uppercase tracking-wide text-zinc-400">Answer?</span>
            {q.statement}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[true, false].map((value) => (
              <Choice
                key={String(value)}
                label={value ? 'True' : 'False'}
                state={choiceState(value === q.isTrue, value === response, reveal)}
                disabled={locked}
                onClick={() => onRespond(value, instant)}
              />
            ))}
          </div>
          {reveal && !q.isTrue && (
            <p className="text-sm text-zinc-500">
              Correct answer: <span className="font-medium text-emerald-600 dark:text-emerald-400">{q.answer}</span>
            </p>
          )}
        </>
      )}

      {q.type === 'written' && (
        <WrittenAnswer q={q} response={response} locked={locked} reveal={reveal} correct={correct} instant={instant} onRespond={onRespond} />
      )}
    </article>
  );
}

/** Option state: before grading only "selected" shows; after, right/wrong. */
function choiceState(isCorrect, isChosen, reveal) {
  if (!reveal) return isChosen ? 'selected' : 'idle';
  if (isCorrect) return 'correct';
  return isChosen ? 'wrong' : 'dim';
}

function WrittenAnswer({ q, response, locked, reveal, correct, instant, onRespond }) {
  // Instant mode keeps a draft until "Check"; Grade-at-end saves every keystroke.
  const [draft, setDraft] = useState(response ?? '');
  const value = instant ? draft : (response ?? '');

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (instant && draft.trim()) onRespond(draft, true);
      }}
    >
      <div className="flex gap-2">
        <input
          className={`input py-2.5 text-base ${reveal ? (correct ? 'border-emerald-500' : 'border-red-500') : ''}`}
          placeholder="Type your answer"
          value={value}
          disabled={locked}
          onChange={(e) => (instant ? setDraft(e.target.value) : onRespond(e.target.value))}
          aria-label={`Answer for question: ${q.prompt}`}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {instant && !locked && (
          <button className="btn-primary shrink-0" disabled={!draft.trim()}>
            Check
          </button>
        )}
      </div>
      {reveal && !correct && (
        <p className="text-sm text-zinc-500">
          Correct answer: <span className="font-medium text-emerald-600 dark:text-emerald-400">{q.answer}</span>
        </p>
      )}
    </form>
  );
}
