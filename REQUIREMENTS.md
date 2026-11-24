# Flashcard App — Requirements (Versions 1–3)

A modern, local-first flashcard web app with Anki-style spaced repetition.
Version 2 adds a study-direction setting plus Quizlet-style **Learn** and **Practice Test** modes (see §8).
Version 3 Part A replaces SM-2 with **FSRS** (via `ts-fsrs`) and adds a Target Retention setting (see §9).
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
| Scheduling | **ts-fsrs** (v3+) | Official FSRS implementation; replaces the hand-written SM-2 |
| Dependencies | `react`, `react-dom`, `ts-fsrs`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `vitest` | Nothing else |

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
│   │   ├── scheduler.js       # FSRS (ts-fsrs) scheduling + interval previews (v3; was SM-2)
│   │   ├── migrate.js         # v3: SM-2 → FSRS card migration
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

### 3.5 Spaced-Repetition Algorithm (SM-2, Anki-style) — *replaced by FSRS in Version 3, see §9*
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
- **NFR-1 Small codebase:** v1 target under ~1,500 lines of source (excluding tests and config); v2 under ~3,000; v3 under ~3,300.
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
  "version": 2,
  "exportedAt": "2026-11-24T12:00:00.000Z",
  "settings": { "theme": "system", "newCardsPerDay": 20, "targetRetention": 0.9 },
  "decks": [
    { "id": "d_abc123", "name": "Spanish", "createdAt": 1700000000000, "answerWith": "back" }
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
      "stability": 4.2,
      "difficulty": 5.1,
      "elapsed_days": 3,
      "scheduled_days": 4,
      "learning_steps": 0,
      "reps": 3,
      "lapses": 0,
      "last_review": 1699740800000
    }
  ],
  "newCardsStudied": { "2026-11-23": { "d_abc123": 5 } }
}
```
This is the Version 3 shape (`"version": 2`). Versions 1–2 wrote `"version": 1` with SM-2 card fields
(`interval`, `ease`, `step` instead of the FSRS fields); those are migrated automatically (§9.3).

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

## 7. Ideas for later versions (out of scope)
- ~~FSRS scheduler~~ (done in v3); FSRS parameter optimization from review history; more per-deck settings; configurable day rollover
- Separate SRS schedules per study direction; Learn/Test results feeding into SRS
- Review history log + stats/heatmap
- Card search, tags, reverse cards, cloze, Markdown/images
- PWA install + optional cloud sync

---

## 8. Version 2 Requirements

V2 builds on the v1 decks, cards, and localStorage schema. **Nothing in v1 changes behavior**:
the SM-2 "Study Due Cards" mode, its keyboard shortcuts, and the JSON backup format keep working.

### 8.1 Compatibility rules
- **C-1** The backup format stays `"version": 1`. V2 only adds one optional deck field,
  `answerWith` (`"back"` default, or `"front"`). V1 backups import into v2 (missing field → `"back"`),
  and v2 backups import into v1 (unknown field is ignored).
- **C-2** Learn and Practice Test are **practice modes**: they never change a card's SM-2 schedule.
  Only "Study Due Cards" (Flashcards) rates cards and schedules reviews.
- **C-3** Learn progress is saved separately under the `flashcards.learn.v1` localStorage key, so it
  survives reloads but is not part of backups (it is cheap to rebuild by learning again).
- **C-4** Study direction is a display choice. A card has one SM-2 schedule no matter which side is shown.

### 8.2 Study Direction ("Answer with Back" / "Answer with Front")
- **D-1** Each deck has a direction setting, shown as a toggle on the deck page:
  - **Answer with Back** (default): the prompt shows the Front; you recall the Back.
  - **Answer with Front**: the prompt shows the Back/definition; you recall the Front/term.
- **D-2** The same toggle appears at the start of every session: Flashcards (in the session header),
  Learn (start screen), and Practice Test (setup screen). Changing it there also updates the deck's setting.
- **D-3** "Study all due cards" (several decks) uses each deck's own setting by default, with a
  session-only override (Deck setting / Answer with Back / Answer with Front).
- **D-4** In Flashcards, the flip animation and all keyboard shortcuts (Space, 1–4, Esc) work the same in
  both directions. The answer side repeats the prompt above the answer.

### 8.3 Learn Mode (adaptive, Quizlet-style)
- **L-1** Learn works through a deck in **rounds** of up to 7 cards until every card is **Mastered**.
- **L-2** Each card has a level: **Remaining** (unseen or struggling) → **Familiar** → **Mastered**.
  - Remaining cards are asked as **4-option multiple choice**.
  - A correct multiple-choice answer promotes the card to Familiar. A Familiar card is asked as a
    **written** (typed) prompt in a **later round**, never the same round.
  - A correct written answer marks the card Mastered.
- **L-3** Each round fills up with Familiar cards first, then struggling cards, then unseen cards in deck order.
  The round order is shuffled.
- **L-4** A wrong answer:
  - immediately shows the correct answer;
  - multiple choice: highlights the right option, and you press **Continue** (Enter) to acknowledge it;
  - written: you must **re-type the correct answer** to continue, or press **"Override: I was right"**
    for a typo, which counts the answer as correct;
  - drops the card back to Remaining and **re-queues it 2 questions later** in the same round.
- **L-5** **Distractors**: three wrong options come from other cards in the same deck, preferring answers
  of similar length and kind (numbers vs. words), with some randomness. Duplicates of the correct answer
  are never shown. If the deck has too few cards, options come from other decks; if there still aren't
  enough, fewer options are shown. If no distractor exists at all, the card is asked as a written prompt.
- **L-6** Written answers are checked ignoring case, accents, punctuation, and extra spaces
  ("brasilia" matches "Brasília").
- **L-7** A live **progress bar** shows Remaining / Familiar / Mastered counts. A round summary appears
  between rounds, and a completion screen offers "Learn again".
- **L-8** Keyboard: `1`–`4` choose an option, `Enter` submits or continues, `Esc` exits.
- **L-9** Progress is saved per deck and direction. Cards added later join as Remaining; deleted cards are dropped.

### 8.4 Practice Test Mode
- **T-1** A setup screen configures:
  - **Question count**: 1 up to the deck size (default: min(20, deck size));
  - **Direction**: Answer with Back / Answer with Front;
  - **Question types**: any combination of Multiple Choice, Written, and True/False (at least one);
  - **Feedback timing**:
    - **Instant feedback**: each answer locks when given, then shows right/wrong and highlights the
      correct answer if wrong;
    - **Grade at end**: answers stay editable until **Submit Test**.
- **T-2** Questions are random cards from the deck, with the chosen types spread evenly. A True/False
  question pairs the prompt with either the real answer or a distractor (50/50). A multiple-choice or
  True/False question that can't get a distractor becomes Written.
- **T-3** Submitting with unanswered questions asks for confirmation; unanswered questions count as wrong.
- **T-4** The results screen shows the **percentage score**, the correct count, and a **breakdown** of every
  question (prompt, your answer, correct answer, right/wrong).
- **T-5** **Retake Missed Questions** builds a new test from only the missed cards, with the same settings.
  **New test** returns to setup.

### 8.5 Updated file structure (additions)
```
src/lib/
  quiz.js              # Prompt/answer sides, answer checking, distractors, shuffle
  learn.js             # Learn-mode rounds and level progression (pure)
  learnStore.js        # Saves Learn progress under its own localStorage key
  practiceTest.js      # Builds and grades practice tests (pure)
  quiz.test.js, learn.test.js, practiceTest.test.js, testUtils.js (seeded random for tests)
src/components/
  Segmented.jsx        # Segmented control + DirectionToggle
  Choice.jsx           # Multiple-choice / True-False option button
  ProgressBar.jsx      # Remaining / Familiar / Mastered bar
  LearnMode.jsx        # Learn start screen, question loop, round summary
  TestMode.jsx         # Practice-test controller (setup → taking → results)
  TestSetup.jsx, TestQuestion.jsx, TestResults.jsx
```

### 8.6 Acceptance Checklist (v2 is done when…)
- [ ] All v1 checklist items still pass; an exported v1 backup imports into v2 unchanged.
- [ ] Switching a deck to "Answer with Front" shows the Back first in Flashcards, Learn, and Test, and
      Space/1–4 still work.
- [ ] In Learn, a new card is asked as multiple choice. After a correct answer, it is asked as written in a
      later round, then becomes Mastered.
- [ ] A missed card shows the answer, needs a re-type or acknowledgment, and comes back 2 questions later.
- [ ] "Override: I was right" counts a typo as correct.
- [ ] A 3-card deck still gets multiple-choice options (taken from other decks, or fewer options).
- [ ] A Practice Test respects count, direction, question types, and feedback timing; results show the
      percentage and breakdown; "Retake Missed Questions" re-tests only the misses.
- [ ] `npm test` and `npm run build` pass.

---

## 9. Version 3 (Part A) Requirements — FSRS Scheduling

### 9.1 FSRS engine
- **F-1** Scheduling uses the official **`ts-fsrs`** package (FSRS-6 default weights) instead of SM-2.
  `scheduler.js` is the only module that imports it, and it keeps the same exports (`schedule`,
  `previewIntervals`, `newCardFields`, `AGAIN/HARD/GOOD/EASY`), so the UI didn't change.
- **F-2** Same four rating buttons (Again / Hard / Good / Easy, keys 1–4) and live next-interval labels.
  A new card shows `1m / 6m / 10m / 8d` at 90% retention.
- **F-3** Learning steps stay `1m, 10m`; the relearning step stays `10m`. Review intervals come from FSRS
  stability and the Target Retention. The maximum interval is 36,500 days (the ts-fsrs default).
- **F-4** Fuzz (ts-fsrs) spreads review dates slightly. The button labels show the un-fuzzed value.
- **F-5** Card `state` is stored as a string (`new` / `learning` / `review` / `relearning`), and dates are
  stored as ms timestamps. They convert to the ts-fsrs `State` enum and `Date` objects inside `scheduler.js`.
  The queue, "Cards Due" counts, Learn, and Test logic are unchanged.
- **F-6** `elapsed_days` (days between the last two reviews) is computed by the app at each review.
  ts-fsrs v6 no longer tracks it on cards, but it's kept for compatibility with other FSRS tools.

### 9.2 Target Retention setting
- **R-1** A **Settings** screen (header button) has a **Target Retention** slider:
  default **90%**, range **85%–97%** in 1% steps. It feeds `request_retention` in the FSRS parameters.
- **R-2** It shows a live example ("Good" every time → e.g. `2d → 11d → 1.5mo → 5.4mo → 1.4y` at 90%).
- **R-3** A change applies from the next review; existing due dates aren't rescheduled.
- **R-4** Invalid stored or imported values are clamped into range. Settings also exposes the existing
  "New cards per day" limit.

### 9.3 Data migration (Version 2 → Version 3)
- **M-1** The data format version goes from `1` to `2`. Both localStorage data and imported JSON
  backups go through the same `validateData → migrateCard` path, so both migrate automatically.
- **M-2** Progress is preserved: `state`, `due`, `reps`, `lapses`, and the learning step are kept as-is,
  so no card becomes due earlier or later because of the upgrade.
- **M-3** Memory estimates:
  - **Review / relearning cards:** `stability` = SM-2 interval (the interval at 90% recall on FSRS's forgetting
    curve). `difficulty` is derived from the ease factor using FSRS's stability-growth formula (the same
    approach FSRS/Anki use for SM-2 cards without review history). Lower ease → higher difficulty.
  - **Learning cards:** memory state from a first FSRS rating (Again for step 0, Good for step 1).
  - **New cards:** FSRS empty-card fields.
  - **`last_review`** is estimated as `due − interval`.
- **M-4** Migration is **idempotent** (FSRS cards pass through unchanged) and **tolerant**: missing
  or invalid fields are repaired, and ts-fsrs' numeric `State` and ISO date strings are accepted.
- **M-5** Safety copy: before the first migration, the original localStorage data is saved once under
  `flashcards.v1.pre-fsrs-backup` (skipped if storage is full).
- **M-6** Backups from a newer format version are rejected with a clear message. Version 2 of the app
  therefore refuses Version 3 backups rather than misreading them.

### 9.4 Acceptance checklist (v3 Part A is done when…)
- [x] Rating buttons and keyboard shortcuts work as before, with FSRS intervals on the labels.
- [x] Target Retention (85–97%, default 90%) changes future intervals; higher means shorter intervals.
- [x] Existing Version 2 localStorage data and backups load with every card's state, due date, reps,
      and lapses unchanged, and with the FSRS fields filled in.
- [x] Unit tests cover FSRS interval progression, target retention, and V2 → V3 migration;
      `npm test` and `npm run build` pass.

