/**
 * Segmented.jsx — a small pill-style radio group, plus DirectionToggle
 * ("Answer with Back" / "Answer with Front") built on top of it.
 */

/**
 * @param {{value: any, label: string, title?: string}[]} options
 * @param {any} value       Currently selected value.
 * @param {(v: any) => void} onChange
 * @param {string} label    Accessible name for the group.
 */
export default function Segmented({ options, value, onChange, label, className = '' }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`cursor-pointer rounded-md px-3 py-1.5 font-medium transition ${
              active
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const DIRECTIONS = [
  { value: 'back', label: 'Answer with Back', title: 'See the Front, recall the Back' },
  { value: 'front', label: 'Answer with Front', title: 'See the Back, recall the Front' },
];

/**
 * Study-direction toggle. With `allowDeckSetting`, adds a "Deck setting"
 * option (value null) for multi-deck sessions.
 */
export function DirectionToggle({ value, onChange, allowDeckSetting = false, className }) {
  const options = allowDeckSetting ? [{ value: null, label: 'Deck setting' }, ...DIRECTIONS] : DIRECTIONS;
  return <Segmented options={options} value={value} onChange={onChange} label="Study direction" className={className} />;
}
