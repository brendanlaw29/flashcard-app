/**
 * ProgressBar.jsx — Learn-mode progress: Mastered (green) and Familiar
 * (amber) segments over a grey track, with a Remaining / Familiar / Mastered legend.
 */

export default function ProgressBar({ counts }) {
  const pct = (n) => (counts.total ? (n / counts.total) * 100 : 0);
  return (
    <div className="space-y-1.5">
      <div
        className="flex h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={counts.total}
        aria-valuenow={counts.mastered}
        aria-label="Cards mastered"
      >
        <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${pct(counts.mastered)}%` }} />
        <div className="bg-amber-400 transition-all duration-500" style={{ width: `${pct(counts.familiar)}%` }} />
      </div>
      <div className="flex justify-between text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
        <span>
          <b className="font-semibold text-zinc-700 dark:text-zinc-200">{counts.remaining}</b> Remaining
        </span>
        <span>
          <b className="font-semibold text-amber-600 dark:text-amber-400">{counts.familiar}</b> Familiar
        </span>
        <span>
          <b className="font-semibold text-emerald-600 dark:text-emerald-400">{counts.mastered}</b> Mastered
        </span>
      </div>
    </div>
  );
}
