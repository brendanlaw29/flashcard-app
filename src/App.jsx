/**
 * App.jsx — top-level layout and simple view switching
 * (home → deck → flashcards / learn / test) without a router library.
 */

import { useState } from 'react';
import { useStore } from './state/store.jsx';
import Home from './components/Home.jsx';
import DeckView from './components/DeckView.jsx';
import StudySession from './components/StudySession.jsx';
import LearnMode from './components/LearnMode.jsx';
import TestMode from './components/TestMode.jsx';
import DataMenu from './components/DataMenu.jsx';
import ThemeToggle, { useApplyTheme } from './components/ThemeToggle.jsx';

export default function App() {
  const { state, error, dismissError } = useStore();
  useApplyTheme(state.settings.theme);

  // view: { name: 'home' } | { name: 'deck', deckId } | { name: 'study', deckId | null }
  //     | { name: 'learn', deckId } | { name: 'test', deckId }
  const [view, setView] = useState({ name: 'home' });
  const goHome = () => setView({ name: 'home' });
  const openDeck = (deckId) => setView({ name: 'deck', deckId });
  const study = (deckId) => setView({ name: 'study', deckId });

  // If the deck being viewed no longer exists (deleted or replaced by an import), go home.
  const deckGone = view.deckId && !state.decks.some((d) => d.id === view.deckId);
  const current = deckGone ? { name: 'home' } : view;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <button onClick={goHome} className="flex cursor-pointer items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="inline-block h-4 w-5 rounded bg-indigo-600" aria-hidden />
          Flashcards
        </button>
        <div className="flex items-center gap-1">
          <DataMenu />
          <ThemeToggle />
        </div>
      </header>

      {error && (
        <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <span>{error}</span>
          <button onClick={dismissError} className="cursor-pointer font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      <main className="flex-1">
        {current.name === 'home' && <Home onOpenDeck={openDeck} onStudy={study} />}
        {current.name === 'deck' && (
          <DeckView
            deckId={current.deckId}
            onBack={goHome}
            onStudy={() => study(current.deckId)}
            onLearn={() => setView({ name: 'learn', deckId: current.deckId })}
            onTest={() => setView({ name: 'test', deckId: current.deckId })}
          />
        )}
        {current.name === 'learn' && <LearnMode deckId={current.deckId} onExit={() => openDeck(current.deckId)} />}
        {current.name === 'test' && <TestMode deckId={current.deckId} onExit={() => openDeck(current.deckId)} />}
        {current.name === 'study' && (
          <StudySession deckId={current.deckId} onExit={() => (current.deckId ? openDeck(current.deckId) : goHome())} />
        )}
      </main>
    </div>
  );
}
