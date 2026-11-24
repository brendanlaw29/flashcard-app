/**
 * QuickImport.jsx — paste many "front<Tab>back" or "front - back" lines at
 * once, with a live preview of what will be added.
 */

import { useMemo, useState } from 'react';
import { parseImport } from '../lib/parseImport.js';

export default function QuickImport({ onImport }) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const { cards, skipped } = useMemo(() => parseImport(text), [text]);

  const submit = () => {
    onImport(cards);
    setMessage(`Added ${cards.length} ${cards.length === 1 ? 'card' : 'cards'}.`);
    setText('');
  };

  return (
    <div className="space-y-3">
      <textarea
        className="input min-h-36 font-mono"
        placeholder={'One card per line, front and back separated by a Tab or a dash:\n\nhola - hello\ngracias\tthank you'}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setMessage('');
        }}
        aria-label="Cards to import"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500" aria-live="polite">
          {message ||
            (text.trim()
              ? `${cards.length} ${cards.length === 1 ? 'card' : 'cards'} will be added` +
                (skipped.length ? `, ${skipped.length} ${skipped.length === 1 ? 'line' : 'lines'} skipped` : '')
              : 'Tip: copy two columns from a spreadsheet — they paste as Tab-separated.')}
        </p>
        <button className="btn-primary" disabled={!cards.length} onClick={submit}>
          Import {cards.length || ''}
        </button>
      </div>
      {skipped.length > 0 && (
        <ul className="space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
          {skipped.slice(0, 5).map((s) => (
            <li key={s.line} className="truncate">
              Line {s.line} has no separator: “{s.text}”
            </li>
          ))}
          {skipped.length > 5 && <li>…and {skipped.length - 5} more</li>}
        </ul>
      )}
    </div>
  );
}
