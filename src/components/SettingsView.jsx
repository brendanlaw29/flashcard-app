/**
 * SettingsView.jsx — app settings: FSRS Target Retention and the daily
 * new-card limit. Changes save immediately.
 */

import { useMemo } from 'react';
import { useStore } from '../state/store.jsx';
import { MIN_RETENTION, MAX_RETENTION, DEFAULT_RETENTION, exampleGoodIntervals } from '../lib/scheduler.js';
import { formatInterval } from '../lib/format.js';
import { DAY } from '../lib/time.js';

export default function SettingsView({ onBack }) {
  const { state, setSetting } = useStore();
  const { targetRetention, newCardsPerDay } = state.settings;
  const percent = Math.round(targetRetention * 100);
  const example = useMemo(() => exampleGoodIntervals(targetRetention, 5), [targetRetention]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <button className="btn-ghost -ml-3" onClick={onBack}>
        ← All decks
      </button>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="panel space-y-4 p-6">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="font-medium">Target retention</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              How likely you want to be to remember a card when it comes up for review. Higher means more
              frequent reviews.
            </p>
          </div>
          <span className="text-3xl font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">{percent}%</span>
        </div>

        <input
          type="range"
          min={MIN_RETENTION * 100}
          max={MAX_RETENTION * 100}
          step={1}
          value={percent}
          onChange={(e) => setSetting('targetRetention', Number(e.target.value) / 100)}
          className="w-full accent-indigo-600"
          aria-label="Target retention percent"
        />
        <div className="flex justify-between text-xs text-zinc-400">
          <span>{MIN_RETENTION * 100}% · fewer reviews</span>
          {percent !== DEFAULT_RETENTION * 100 && (
            <button className="cursor-pointer underline" onClick={() => setSetting('targetRetention', DEFAULT_RETENTION)}>
              Reset to {DEFAULT_RETENTION * 100}%
            </button>
          )}
          <span>{MAX_RETENTION * 100}% · more reviews</span>
        </div>

        <p className="rounded-lg bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-800/60">
          <span className="text-zinc-500">A new card answered “Good” every time is reviewed after: </span>
          <span className="font-medium tabular-nums">{example.map((d) => formatInterval(d * DAY)).join(' → ')}</span>
        </p>
        <p className="text-xs text-zinc-500">
          Applies from your next review. Cards keep their current due dates until then.
        </p>
      </section>

      <section className="panel flex items-center justify-between gap-4 p-6">
        <div>
          <h2 className="font-medium">New cards per day</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Maximum new cards introduced per deck each day.</p>
        </div>
        <input
          type="number"
          min={0}
          max={9999}
          className="input w-24"
          value={newCardsPerDay}
          onChange={(e) => {
            const n = e.target.valueAsNumber;
            if (Number.isFinite(n) && n >= 0) setSetting('newCardsPerDay', Math.min(9999, Math.round(n)));
          }}
          aria-label="New cards per day"
        />
      </section>
    </div>
  );
}
