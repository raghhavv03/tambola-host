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

## Later (not this iteration)

Design system and animation · theme packs · native app build · accounts and social
login · backend (fixes the code-vs-QR rule-sharing gap, enables live sync and rooms that
outlive one device) · cross-game stats.
