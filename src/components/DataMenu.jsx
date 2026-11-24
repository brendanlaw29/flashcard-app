/**
 * DataMenu.jsx — Export (download a JSON backup) and Import (restore one,
 * choosing Replace or Merge).
 */

import { useRef, useState } from 'react';
import { useStore } from '../state/store.jsx';
import { downloadBackup, validateData } from '../lib/storage.js';
import { dayKey } from '../lib/time.js';

export default function DataMenu() {
  const { state, replaceAll, mergeData } = useStore();
  const fileInput = useRef(null);
  // pending: { data } after a valid file is chosen, { error } if it was invalid.
  const [pending, setPending] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again later
    if (!file) return;
    try {
      setPending({ data: validateData(JSON.parse(await file.text())) });
    } catch (err) {
      setPending({ error: err instanceof SyntaxError ? 'That file is not valid JSON.' : err.message });
    }
  };

  const apply = (mode) => {
    if (mode === 'replace') replaceAll(pending.data);
    else mergeData(pending.data);
    setPending(null);
  };

  return (
    <>
      <button className="btn-ghost px-2 sm:px-3.5" onClick={() => downloadBackup(state, dayKey(Date.now()))} title="Download a JSON backup">
        Export
      </button>
      <button className="btn-ghost px-2 sm:px-3.5" onClick={() => fileInput.current.click()} title="Restore from a JSON backup">
        Import
      </button>
      <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />

      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setPending(null)}
        >
          <div role="dialog" aria-modal="true" className="panel w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {pending.error ? (
              <>
                <h2 className="text-lg font-semibold">Couldn't import that file</h2>
                <p className="mt-2 text-sm text-zinc-500">{pending.error} Nothing was changed.</p>
                <div className="mt-6 flex justify-end">
                  <button className="btn-primary" onClick={() => setPending(null)} autoFocus>
                    OK
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Import backup</h2>
                <p className="mt-2 text-sm text-zinc-500">
                  This file has {pending.data.decks.length} decks and {pending.data.cards.length} cards.
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li>
                    <b>Merge</b> adds decks and cards you don't already have.
                  </li>
                  <li>
                    <b>Replace</b> deletes everything currently in the app and loads the backup instead.
                  </li>
                </ul>
                <div className="mt-6 flex justify-end gap-2">
                  <button className="btn-ghost" onClick={() => setPending(null)}>
                    Cancel
                  </button>
                  <button className="btn-danger" onClick={() => apply('replace')}>
                    Replace all
                  </button>
                  <button className="btn-primary" onClick={() => apply('merge')} autoFocus>
                    Merge
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
