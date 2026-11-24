/**
 * DueCounts.jsx — the colored "New · Learning · Review" numbers used on the
 * home screen, deck rows, and study progress bar (Anki's blue/orange/green).
 */

export default function DueCounts({ counts, className = '' }) {
  const item = (n, label, color) => (
    <span className={`${n ? color : 'text-zinc-400 dark:text-zinc-600'} tabular-nums`} title={label}>
      {n} <span className="text-xs font-normal opacity-80">{label}</span>
    </span>
  );
  return (
    <span className={`inline-flex gap-3 text-sm font-medium ${className}`}>
      {item(counts.new, 'new', 'text-sky-600 dark:text-sky-400')}
      {item(counts.learning, 'learning', 'text-orange-600 dark:text-orange-400')}
      {item(counts.review, 'review', 'text-emerald-600 dark:text-emerald-400')}
    </span>
  );
}
