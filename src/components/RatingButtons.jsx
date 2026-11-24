/**
 * RatingButtons.jsx — Again / Hard / Good / Easy, each showing the interval
 * the card would get (e.g. "10m", "4d") and its keyboard shortcut.
 */

import { AGAIN, HARD, GOOD, EASY, previewIntervals } from '../lib/scheduler.js';
import { formatInterval } from '../lib/format.js';

const BUTTONS = [
  { rating: AGAIN, label: 'Again', color: 'text-red-600 dark:text-red-400' },
  { rating: HARD, label: 'Hard', color: 'text-amber-600 dark:text-amber-400' },
  { rating: GOOD, label: 'Good', color: 'text-emerald-600 dark:text-emerald-400' },
  { rating: EASY, label: 'Easy', color: 'text-sky-600 dark:text-sky-400' },
];

export default function RatingButtons({ card, now, onRate }) {
  const intervals = previewIntervals(card, now);

  return (
    <div className="grid grid-cols-4 gap-2">
      {BUTTONS.map(({ rating, label, color }) => (
        <button key={rating} className="btn-secondary flex-col gap-0.5 py-3" onClick={() => onRate(rating)}>
          <span className="text-xs text-zinc-500 tabular-nums">{formatInterval(intervals[rating])}</span>
          <span className={`text-base font-semibold ${color}`}>{label}</span>
          <span className="kbd hidden sm:inline">{rating}</span>
        </button>
      ))}
    </div>
  );
}
