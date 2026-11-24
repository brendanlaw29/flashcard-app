/**
 * Choice.jsx — one answer option (multiple choice or True/False), styled by
 * state: idle, selected, correct, wrong, or dimmed after grading.
 */

const STYLES = {
  idle: 'border-zinc-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/30',
  selected: 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:bg-indigo-950/40',
  correct: 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100',
  wrong: 'border-red-500 bg-red-50 text-red-900 ring-1 ring-red-500 dark:bg-red-950/40 dark:text-red-100',
  dim: 'border-zinc-200 bg-white opacity-50 dark:border-zinc-800 dark:bg-zinc-900',
};

/**
 * @param {string} label
 * @param {string|number} [shortcut]  Key hint shown on the left (e.g. 1–4).
 * @param {'idle'|'selected'|'correct'|'wrong'|'dim'} [state]
 */
export default function Choice({ label, shortcut, state = 'idle', disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={state === 'selected'}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition enabled:cursor-pointer sm:text-base ${STYLES[state]}`}
    >
      {shortcut !== undefined && <span className="kbd shrink-0">{shortcut}</span>}
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{label}</span>
      {state === 'correct' && <span aria-label="correct">✓</span>}
      {state === 'wrong' && <span aria-label="incorrect">✗</span>}
    </button>
  );
}
