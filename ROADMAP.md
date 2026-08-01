# Roadmap — v2 (branch `major-changes`)

Read with `PRD.md`. Terse by design: one line per thing. Phases are sequential; each one
ends with a working app.

---

## P0 — Demolition and skeleton

**Delete**

- `themes/` (both packs), `src/themes/*` (types, loader, registry, stage tokens),
  `ThemePicker`, `THEME_PACK_GUIDE.md`
- `src/components/DisplayMode.tsx` and the `?display=1` route (cast-to-TV, removed)
- `src/sound.ts`, `useDrawWithSound`, `useReducedMotionSetting`, `PaceIndicator`,
  `GameOverCard`, `RecentNumbers`, `icons.tsx`, `HomeScreen`, `App.tsx`
- Fraunces (`@fontsource-variable/fraunces`), `motion`, all stage/glow/`btn-accent` CSS
- `RUNBOOK.md`, `UI_INVENTORY.md`, old `PROGRESS.md` content

**Keep (earns its place)**

- `src/engine/rng.ts`, `caller.ts`, `ticket.ts`, `ticketId.ts` + their tests — the whole
  seeded-ticket-as-recipe idea is the foundation of room codes
- `src/player/marks.ts`, `airgap.test.ts` (rewritten for the new module graph)
- `src/components/QrCode.tsx`, `TicketFace.tsx`, `PrintSheet.tsx`, `ticketLink.ts`
- `src/store/persist.ts`, `settingsStore.ts` patterns
- Vite + React + TS + Tailwind + Vitest + PWA setup; `android/` and `capacitor.config.ts`
  parked untouched

**Add**

- Fresh `CLAUDE.md` and `PROGRESS.md` written against the PRD
- Plain base CSS: type scale, spacing scale, control heights, black/white/grey only
- Front door with two doors: **Conduct a game** / **Join a game**

## P1 — Engine for the new rules

- `patterns.ts` — a condition is `{ id, name, positions[] on the 3×5 logical grid, points }`;
  the six presets become built-in patterns
- `verifyClaim` rewritten to take a pattern, not a fixed dividend enum
- Room config type + encode/decode: room code (base32 seed + presets + points), and the
  full config blob for QR links
- Points validator: must total exactly 100
- Tests: patterns, verification, round-trip encode/decode of a room code

## P2 — Conductor setup

- Room name, player count, tickets per player, seed
- Condition picker: presets on/off, custom pattern editor on the 3×5 grid, points per
  condition with a live running total and a blocked Start until it hits 100
- Distribution screen: room code big, per-ticket QRs, seat issue list, print sheet
- Config persisted locally (`tambola:room:setup`). Freezing the rules at the first draw
  moves to P3 — P2 has no draw to freeze at.

## P3 — Conductor live game

- Draw / undo, big number, 90-board, called count; rules freeze at the first draw
- Conditions panel: open / won-by-seat, points
- Verifier: ticket ID + condition, VALID / BOGEY with missing numbers, confirm ruling
- Bogey tracking per seat; results screen at the end
- Resume after reload or phone lock

## P4 — Player journey

- Join by QR (link) and by room code + seat number
- Ticket screen: grid, tap to mark/unmark, ticket ID, room name, multiple tickets
- Call-a-win control (records intent, tells the player to shout, transmits nothing)
- Self-recorded outcome: won / bogey
- Prize section: conditions won, points each, running total, bogeys shown as ineligible
- `airgap.test.ts` green: player bundle imports no caller, no conductor store, no network

## P5 — Consistency pass

- Every screen on the same type/spacing/control scale, positioned as the designed
  version will be
- Empty states, error states, back navigation everywhere
- Build + lint + browser walk-through of both journeys end to end

## P6 — House-rule extensions (from friend playtesting, PRD.md §7.3–7.5)

- **Late-claim house rule.** New pure `completionCall(ticket, history, pattern)` —
  the call count at which a pattern first became satisfied, versus `Ruling.atCall`
  (already recorded) which is when it was actually ruled. A per-room toggle in
  `RoomConfig` (`strictClaimTiming`, default false). `ClaimVerifier` shows "completed
  at call N" against the current call count when the toggle is on; the conductor
  still rules — the app surfaces the fact, not the verdict.
- **Tie rulings (split points).** `winnerOf` / `openConditions` / `seatScores` in
  `conductor/game.ts` currently assume "first valid ruling per condition wins" —
  needs to become "however many valid rulings a condition has, divide its points
  evenly across them." `ClaimVerifier` gains an explicit "tie with seat NN" path,
  offered only against a condition that's still open. Remainder-on-split rule:
  extra point to the lower seat number. `ResultsScreen` shows splits by name.
- **"Add another" on a preset.** `ConditionsEditor` lets a preset be added a second
  time (auto-suffixed id, e.g. `fullHouse-2`) instead of requiring a hand-drawn
  duplicate in `PatternEditor`. No engine change — a duplicate is a non-preset id
  the moment it's added, so it already rides QR-only same as any custom condition
  (D1, unchanged). This alone already covers "two Full Houses" today, just clunkily.
- Tests: `completionCall` (on time / late / pattern never satisfied), a split-points
  round trip through `seatScores` including the remainder case.

## P7 — The player's side of a split (PRD.md §7.5)

- `player/claims.ts`: a claim record becomes `{ state, winners }` instead of a bare
  state string, with `loadClaims` reading the old bare string as `winners: 1` so a
  player mid-game keeps their notes. `shareLow` / `shareHigh` / `formatShare`, and
  `pointsWon` returning a `{ low, high }` range.
- `player/PrizeList`: a won row carries a "Shared — N ways" select and shows the
  share ("3–4 pts"), with the range explained only once a range is on screen. The
  phone knows how many ways, never which seats, so it never guesses the odd point.
- Tests: the record round-trip, the legacy bare-string read, winner-count clamping,
  and the share range including the case that divides evenly.

## P8 — What a typed code carries, and giving a seat out once (from playtesting)

- `engine/patterns.ts`: the preset-copy vocabulary in one place — `presetCopyId`,
  `presetCopyName`, `presetCopy`, `parsePresetCopyId`, `MAX_PRESET_COPY` — used by both
  the setup screen and the room code so "Full House 2" is only spelled once.
- `engine/room.ts`: the room code gains a copy list (1 bit "another follows", 3 bits
  preset index, 2 bits copy number, 7 bits points, 0 bit to end). An old code decodes
  unchanged and a copy-less room writes the identical string. `hasCustomConditions`
  becomes `uncarriedConditions`, which is what the two warnings now name out loud.
- `player/TicketScreen`: says how many points sit on prizes the link couldn't name,
  derived as 100 minus what arrived. No extra bits, no channel.
- `conductor/DistributionScreen`: a seat marked given loses its QR and leaves the print
  sheet until the conductor undoes it.
- Tests: copy round-trips (several presets, a copy whose preset is switched off, a
  sixth copy falling out), the legacy code literal, and copy-id parsing.

## P9 — Correctness: undo and ruling integrity (built)

The app is deployed. These four bugs are what stand between that and a real game — none
of them are features, all of them are the app breaking its own stated guarantees.

- **Undo after a ruling corrupts the saved game.** `handleUndo` (`conductor/
  ConductorApp.tsx`) shortens `game.history` but never touches `game.rulings`, so a
  ruling's `atCall` can end up greater than the new history length. `parseRulings`
  (`conductor/game.ts`) rejects that the next time the game loads — `parseStoredGame`
  returns null, `ConductorApp` reads that as "no game", and the conductor comes back
  to distribution with the whole game gone and the rules unfrozen. It doesn't show up
  until a reload, which is exactly when a party conductor's phone lock hits.
  - Fix: `handleUndo` refuses when
    `game.rulings.some(r => r.atCall === game.history.length)` — the draw about to be
    undone is one a ruling actually depends on — and `CallerScreen` says why instead of
    the button just doing nothing. Pairs with the next item: undo the ruling first, and
    the draw is free again.
- **A ruling can't be corrected.** No screen offers a way back from a mis-typed seat or
  a wrong button tap. The player's own ledger has undo on every row (P4); the
  conductor's does not, and the conductor's is the one that's the source of truth (D2)
  — the one ledger in the app with no way to fix a slip is the one that decides the
  money split.
  - Add `handleUndoRuling(index: number)` to `ConductorApp` —
    `rulings.filter((_, i) => i !== index)` — and a "Recent rulings" list on
    `CallerScreen` (most recent first, capped like the recent-calls strip) with a
    `.btn-inline` "Undo" per row, the same look the distribution list's seat-undo
    already uses. This is framed as correcting the record, not reopening a fairly-won
    prize — the app has no way to tell those two apart, so the UI doesn't pretend to.
    A confirm step guards a stray tap, the same weight as "Start a different room".
- Tests: a regression case for the undo-corruption bug through the real
  `parseStoredGame` / `parseRulings` path; `handleUndoRuling` reopening a condition it
  was the sole winner of, and clearing a bogey so the seat is eligible again.

## P10 — Offline reliability (built)

- **Offline only works at `/`.** `sw.ts` is precache-only with no navigation fallback —
  Workbox's precache route only matches precached files, and `/t`, `/join`, `/conduct`
  aren't files, they're SPA paths `vercel.json` rewrites to `index.html` at the server.
  Offline, there's no server to do that rewrite, so a scanned QR opened without signal
  gets a network error. This contradicts both `sw.ts`'s own header comment ("a scanned
  /t ticket works offline") and CLAUDE.md's "offline-capable".
  - Fix: `registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))` in
    `sw.ts`, mirroring what `vercel.json`'s rewrite already does online. Needs
    `workbox-routing` added as a dependency (workbox-precaching is already one).
  - No vitest coverage is possible — Workbox's navigation matching is a browser-only
    API. Verify with DevTools offline mode per CLAUDE.md's build + lint + browser-check
    bar: load the app once online (so it precaches), go offline, open a `/t#…` link
    cold.

## P11 — Live-game ergonomics (built)

- **The caller screen loses the called number while checking a claim.**
  `ClaimVerifier` sits below the board and the conditions panel on `CallerScreen`, so
  confirming a claim scrolls the "just called" number off screen — the one number
  everyone in the room is also looking at, mid-verification. Fix: a lightweight header
  repeating the latest call while scrolled. No colour or animation added — doesn't
  touch the "no design system" rule, it's layout, not decoration.
  - Built as `position: fixed` (`.call-bar`) shown by an `IntersectionObserver` on the
    callout card, not `position: sticky` as sketched: sticky reserves its space back at
    the top of the document, so an element that only appears part-way down a scroll
    shoves the page under the conductor's thumb as it mounts.
- **Handing out tickets one by one doesn't scale past a few players.**
  `DistributionScreen` pages 6 seats at a time with one tap each; a 30-player room is
  five pages of individual taps while a room full of people waits. Add a per-page
  "Mark this page given" bulk action, same confirm-weight as the screen's other bulk
  state changes.
  - Built as `withSeatsIssued` (`conductor/room.ts`) plus a confirm on
    `DistributionScreen`, offered from two ungiven seats up. Adds only — no bulk undo,
    per the P8 rule that a seat handed over stops being offered.
- Tests: only where a bulk-issue helper is pure enough to earn one (`room.ts`); the
  rest is a browser walk-through per CLAUDE.md's testing bar — these are layout and
  flow changes, not new logic.

## P12 — Optional seat labels (built)

- Conductor-side only, no carrier change, no airgap impact: the player's bundle never
  sees a name, so nothing is added to the room code or the QR blob — this is a label
  the conductor privately attaches to a seat number they already control.
- `StoredRoom` (`conductor/room.ts`) gains `seatNames: Record<number, string>`, saved
  and loaded the same way `issuedSeats` already is.
- Wired into every place a seat number is shown on the conductor's side —
  `DistributionScreen` (a name field next to "Mark given"), `CallerScreen`'s
  conditions panel and bogey list, `ClaimVerifier`, `ResultsScreen` — as
  "Priya · seat 04" when a name exists, falling back to "Seat 04" always.
  `ResultsScreen` is what gets read out at the end of the night; naming it beats a
  room full of "seat 07"s when it's time to actually split what got pooled.
  - Built as `withSeatName` / `seatLabel` / `seatLabelInline` in `conductor/room.ts`,
    with the field on each distribution row. Names stay editable mid-game — the rules
    freeze at the first draw, a private label is not a rule.
  - `withSeatName` caps but does not trim: it runs on every keystroke of a controlled
    input, and trimming there ate the space in "Priya K" before the surname could be
    started. `parseStoredRoom` does the trimming, on load.
- Tests: `seatNames` persistence round-trip in `room.test.ts`.

## Later (not this iteration)

Design system and animation · theme packs · native app build · accounts and social
login · backend (fixes the code-vs-QR rule-sharing gap, enables live sync and rooms that
outlive one device) · cross-game stats.

Also noted, not queued:

- Traditional book-of-6 ticket generation. `generateSet` (`engine/ticket.ts`) gives
  distinct tickets, not the traditional book-of-6 partition of 1–90 — documented in
  the code, not a bug, just not what a paper tambola book does. A different algorithm
  if it's ever wanted.
- A one-screen pilot of the eventual design pass, run before the pass itself, to test
  PRD §10's "lands without a rebuild" claim while it's cheap to be wrong — one screen
  to redo, not a dozen screens that have hardened around plain CSS in the meantime.
