/**
 * TestSetup.jsx — configure a Practice Test: question count, direction,
 * question types, and feedback timing.
 */

import Segmented, { DirectionToggle } from './Segmented.jsx';
import { QUESTION_TYPES } from '../lib/practiceTest.js';

export default function TestSetup({ deckSize, config, onChange, onDirectionChange, onStart }) {
  const set = (fields) => onChange({ ...config, ...fields });
  const toggleType = (t) =>
    set({ types: config.types.includes(t) ? config.types.filter((x) => x !== t) : [...config.types, t] });
  const countOk = config.count >= 1 && config.count <= deckSize;
  const canStart = deckSize > 0 && countOk && config.types.length > 0;

  return (
    <div className="panel space-y-6 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Practice test</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Tests don't change your flashcard review schedule.</p>
      </div>

      <Field label="Questions" hint={`max ${deckSize}`}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="input w-24"
            min={1}
            max={deckSize}
            value={Number.isNaN(config.count) ? '' : config.count}
            onChange={(e) => set({ count: e.target.valueAsNumber })}
            aria-label="Number of questions"
          />
          <button type="button" className="btn-ghost" onClick={() => set({ count: deckSize })}>
            All {deckSize}
          </button>
        </div>
        {!countOk && deckSize > 0 && <p className="mt-1 text-xs text-red-600">Choose between 1 and {deckSize}.</p>}
      </Field>

      <Field label="Direction">
        <DirectionToggle value={config.answerWith} onChange={onDirectionChange} />
      </Field>

      <Field label="Question types">
        <div className="flex flex-wrap gap-2">
          {QUESTION_TYPES.map((t) => {
            const on = config.types.includes(t.value);
            return (
              <button
                key={t.value}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggleType(t.value)}
                className={`btn border ${
                  on
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                    : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800'
                }`}
              >
                <span aria-hidden>{on ? '✓' : '+'}</span> {t.label}
              </button>
            );
          })}
        </div>
        {config.types.length === 0 && <p className="mt-1 text-xs text-red-600">Pick at least one type.</p>}
      </Field>

      <Field label="Feedback">
        <Segmented
          label="Feedback timing"
          value={config.feedback}
          onChange={(feedback) => set({ feedback })}
          options={[
            { value: 'instant', label: 'Instant feedback', title: 'See right/wrong as soon as you answer' },
            { value: 'end', label: 'Grade at end', title: 'Change answers freely, then submit' },
          ]}
        />
        <p className="mt-1.5 text-xs text-zinc-500">
          {config.feedback === 'instant'
            ? 'Each answer locks as soon as you give it, then shows whether it was right.'
            : 'You can change answers until you click Submit Test.'}
        </p>
      </Field>

      <button className="btn-primary w-full py-3 text-base" disabled={!canStart} onClick={onStart}>
        Start test
      </button>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">
        {label} {hint && <span className="font-normal text-zinc-400">({hint})</span>}
      </p>
      {children}
    </div>
  );
}
