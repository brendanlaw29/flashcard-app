# Flashcard App — Version 1 Requirements

A modern, local-first flashcard web app with Anki-style spaced repetition.
No backend, no database, no accounts. All data lives in the browser.

---

## 1. Goals & Non-Goals

**Goals**
- Fast, minimalist study experience that feels like a modern Anki.
- Zero setup beyond `npm install && npm run dev`.
- Data is never lost: everything is saved automatically and can be exported to a JSON file.
- Small, modular, well-commented codebase that is easy to extend in v2.

**Non-Goals (v1)**
- No sync, login, or cloud storage.
- No rich text, images, audio, or cloze cards (plain-text front/back only).
- No mobile app (but the layout must work in a mobile browser).
- No statistics charts beyond the daily "Cards Due" counter.

---

## 2. Proposed Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Build tool | **Vite 8** | Instant dev server, zero-config React setup |
| UI | **React 19** (JavaScript + JSDoc comments) | Familiar, component-based; plain JS keeps the codebase small |
| Styling | **Tailwind CSS v4** (via `@tailwindcss/vite`) | Utility classes, `dark:` variant for dark mode; configured in CSS, so no `tailwind.config.js` |
| Routing | **None** — simple view state in `App.jsx` | Only 3 screens; a router library is unnecessary |
| State | React `useReducer` + Context, persisted to `localStorage` | No external state library needed |
| Storage | Browser `localStorage` (single versioned JSON key) | No database setup |
| Testing | **Vitest** for the logic in `src/lib` | The SRS algorithm is the one place bugs hurt most |
| Dependencies | `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `vitest` | Nothing else |

**Prerequisite:** Node.js 18+ (verified working: Node v26.13.1, npm 11.20.0).

### Running it
```bash
npm install     # once
npm run dev     # start at http://localhost:5173
npm test        # scheduler / parser / storage unit tests
npm run build   # production build into dist/
```

### File structure
```
flashcard-app/
├── index.html                 # Page shell; applies the saved theme before React loads
├── package.json
├── vite.config.js             # React + Tailwind plugins
├── src/
│   ├── main.jsx               # React entry point
│   ├── App.jsx                # Header, storage-error banner, view switching
│   ├── index.css              # Tailwind setup, shared button/input styles, flip-card CSS
│   ├── lib/                   # Pure logic, no React
│   │   ├── scheduler.js       # SM-2 algorithm + interval previews
│   │   ├── queue.js           # "Due today" counts and next-card selection
│   │   ├── storage.js         # localStorage load/save, validate, merge, JSON download
│   │   ├── sampleDeck.js      # First-run sample deck (World Capitals, 15 cards)
│   │   ├── parseImport.js     # Quick Import text parser
│   │   ├── format.js          # Interval formatting ("10m", "4d", "2mo")
│   │   ├── time.js            # Local-day helpers (midnight rollover)
│   │   └── scheduler.test.js  # Unit tests
│   ├── state/
│   │   └── store.jsx          # Context + reducer (decks, cards, actions), debounced autosave
│   └── components/
│       ├── Home.jsx           # Cards Due counter + deck list + new deck
│       ├── DeckView.jsx       # Rename/delete deck, add/edit/delete cards, search
│       ├── QuickImport.jsx    # Paste box for bulk cards with live preview
│       ├── StudySession.jsx   # Study loop + keyboard shortcuts
│       ├── FlipCard.jsx       # 3D flip card
│       ├── RatingButtons.jsx  # Again/Hard/Good/Easy with interval preview
│       ├── DueCounts.jsx      # Colored new/learning/review numbers
│       ├── DataMenu.jsx       # Export / Import JSON (Replace or Merge)
│       └── ThemeToggle.jsx    # System / Light / Dark
```

---

## 3. Functional Requirements

### 3.1 Decks & Cards
- **FR-1** Create a deck with a name (non-empty, trimmed).
- **FR-2** Rename a deck (inline edit).
- **FR-3** Delete a deck, with a confirmation dialog stating how many cards will be deleted.
- **FR-4** Inside a deck: add a single card (Front / Back), edit a card, delete a card.
- **FR-5** Each deck row on the home screen shows: name, total cards, new cards, and cards due today.

### 3.2 Quick Import
- **FR-6** A textarea in each deck where the user pastes many cards, one per line.
- **FR-7** Each line is split into front/back on the **first** separator found, checked in this order:
  1. a **Tab** character
  2. ` - ` (space-dash-space)
  3. ` — ` (em dash) or `-` with no spaces, as a fallback
- **FR-8** Blank lines are ignored. Lines with no separator or an empty side are reported as skipped.
- **FR-9** Show a live preview ("12 cards will be added, 1 line skipped") before the user clicks **Import**.
- **FR-10** Imported cards start as **New** cards.

### 3.3 Persistence, Export & Import
- **FR-11** All decks, cards, and scheduling data are saved to `localStorage` automatically after every change.
- **FR-12** Data is stored under one key (e.g. `flashcards.v1`) with a `version` field so the format can be migrated later.
- **FR-13** **Export** downloads a file named `flashcards-backup-YYYY-MM-DD.json` containing all data.
- **FR-14** **Import** accepts that JSON file, validates its shape, and asks the user to choose:
  - **Replace** all current data, or
  - **Merge** (add decks/cards whose IDs don't already exist).
- **FR-15** Invalid files show a clear error and change nothing.
- **FR-16** If `localStorage` is full or unavailable, show a warning banner recommending an export.

### 3.4 Study Mode ("Study Due Cards")
- **FR-17** Start a session per deck, or "Study All" across every deck.
- **FR-18** Session queue = cards due now (learning/relearning first, then review), then new cards up to a **daily new-card limit (default 20 per deck)**.
- **FR-19** Card shows the front; flipping reveals the back with a smooth **3D flip animation** (~400 ms, CSS `transform: rotateY`).
- **FR-20** Rating buttons appear only after the card is flipped.
- **FR-21** Each rating button shows the **next interval** it would schedule, e.g. `Again 1m · Hard 6m · Good 10m · Easy 4d`.
- **FR-22** Keyboard shortcuts:
  | Key | Action |
  |---|---|
  | `Space` / `Enter` | Flip card (or rate **Good** if already flipped) |
  | `1` | Again |
  | `2` | Hard |
  | `3` | Good |
  | `4` | Easy |
  | `Esc` | Exit session |
- **FR-23** Cards rated into a short learning step (e.g. 1m, 10m) re-enter the queue during the same session when they come due.
- **FR-24** A progress indicator shows remaining cards (New / Learning / Review counts).
- **FR-25** When the queue is empty, show a "Congratulations — you're done for today" screen with the number of cards reviewed.

### 3.5 Spaced-Repetition Algorithm (SM-2, Anki-style)
Implemented as **pure functions** in `scheduler.js` so it can be unit-tested and swapped for FSRS later.

**Card scheduling fields**
```js
{
  state: "new" | "learning" | "review" | "relearning",
  due: 1700000000000,  // timestamp (ms) of next review
  interval: 0,         // days (for review cards)
  ease: 2.5,           // ease factor, minimum 1.3
  step: 0,             // index into learning steps
  reps: 0,             // total successful reviews
  lapses: 0            // times forgotten after graduating
}
```

**Settings (defaults, constants in v1)**
- Learning steps: `1m, 10m`
- Relearning steps: `10m`
- Graduating interval: `1d` · Easy interval: `4d`
- Starting ease: `2.5` · Minimum ease: `1.3`
- Easy bonus: `1.3` · Hard multiplier: `1.2`
- Maximum interval: `365d`

**Rules**
- **New / Learning**
  - Again → back to step 0 (1m)
  - Hard → repeat current step (shown as the average of current and next step, e.g. 6m)
  - Good → next step; after the last step, graduate to review with interval 1d
  - Easy → graduate immediately with interval 4d
- **Review**
  - Again → lapse: `lapses+1`, `ease −0.20`, move to relearning (10m); new interval = `max(1, interval × 0.5)` after relearning
  - Hard → `interval × 1.2`, `ease −0.15`
  - Good → `interval × ease`
  - Easy → `interval × ease × 1.3`, `ease +0.15`
  - Each new interval is at least 1 day longer than the previous one for Hard/Good/Easy, and Hard < Good < Easy always holds.
- **Relearning** follows the learning rules using relearning steps, then returns to review.
- A small random **fuzz** (±5%) is applied to review intervals ≥ 3 days to avoid cards clumping on the same day.
- `previewIntervals(card, now)` returns the four next intervals for the rating buttons without changing the card.

**Interval display format:** `<1m`, `1m`, `10m`, `1h`, `1d`, `4d`, `3w`, `2mo`, `1.2y`.

### 3.6 Home Screen & UI
- **FR-26** Home screen headline shows a large **"Cards Due Today"** counter (all decks), with a small breakdown (New / Learning / Review).
- **FR-27** "Due today" = cards whose `due` is before the end of the current local day (daily rollover at local midnight; can be made configurable later).
- **FR-28** Dark mode: **Light / Dark / System** toggle, remembered in `localStorage`, implemented with Tailwind's `class` strategy.
- **FR-29** Minimalist design: neutral palette, one accent color, generous spacing, system font stack, no clutter.
- **FR-30** Responsive: usable from 360 px (phone) to desktop widths; rating buttons are large tap targets on mobile.
- **FR-31** Empty states: friendly prompts when there are no decks, no cards, or nothing due.
- **FR-32** On first launch (nothing saved yet), a **sample deck** ("Sample: World Capitals", 15 cards) is loaded so the app can be tried immediately. Deleting it is permanent; it never reappears once data has been saved.

---

## 4. Non-Functional Requirements
- **NFR-1 Small codebase:** target under ~1,500 lines of source (excluding tests and config).
- **NFR-2 Modular:** algorithm, storage, and parsing logic live in `src/lib/` with no React imports.
- **NFR-3 Commented:** every file starts with a short header comment; every exported function has a JSDoc comment; the scheduler explains each rule inline.
- **NFR-4 Performance:** smooth with 10,000 cards (localStorage writes are debounced).
- **NFR-5 Accessibility:** buttons are real `<button>`s, visible focus rings, `aria-label`s on icon buttons, animations respect `prefers-reduced-motion`.
- **NFR-6 Browser support:** latest Chrome, Safari, Firefox, Edge.
- **NFR-7 Offline:** works without network once loaded (no external fonts/CDNs).

---

## 5. Data Model (export file shape)
```json
{
  "version": 1,
  "exportedAt": "2026-11-23T12:00:00.000Z",
  "settings": { "theme": "system", "newCardsPerDay": 20 },
  "decks": [
    { "id": "d_abc123", "name": "Spanish", "createdAt": 1700000000000 }
  ],
  "cards": [
    {
      "id": "c_xyz789",
      "deckId": "d_abc123",
      "front": "hola",
      "back": "hello",
      "createdAt": 1700000000000,
      "state": "review",
      "due": 1700086400000,
      "interval": 4,
      "ease": 2.5,
      "step": 0,
      "reps": 3,
      "lapses": 0
    }
  ],
  "newCardsStudied": { "2026-11-23": { "d_abc123": 5 } }
}
```

---

## 6. Acceptance Checklist (v1 is done when…)
- [ ] I can create, rename, and delete decks; deletion asks for confirmation.
- [ ] Pasting `apple\tmanzana` and `dog - perro` lines into Quick Import creates the right cards.
- [ ] Refreshing the browser keeps all decks, cards, and schedules.
- [ ] Export downloads a JSON file; importing it into a fresh browser restores everything.
- [ ] In study mode, Space flips with an animation and 1–4 rate the card.
- [ ] A new card shows `1m / 6m / 10m / 4d` on its buttons; a graduated card shows day-based intervals.
- [ ] Learning cards come back in the same session after their step delay.
- [ ] Home screen shows the correct "Cards Due Today" count.
- [ ] Dark mode toggle works and persists.
- [ ] `npm test` passes the scheduler unit tests.
- [ ] First launch shows the sample deck with 15 new cards due.

---

## 7. Ideas for v2 (out of scope)
- FSRS scheduler option, per-deck settings, configurable day rollover
- Review history log + stats/heatmap
- Card search, tags, reverse cards, cloze, Markdown/images
- PWA install + optional cloud sync
