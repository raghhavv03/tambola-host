# Progress

State, not rules. Read with `PRD.md` (spec), `ROADMAP.md` (plan) and `CLAUDE.md`
(rules). Updated at the end of each pass. One line per thing, not prose.

## Done

- **P0 demolition + skeleton** (branch `major-changes`).
  - Deleted: all theme packs and the theme system (`themes/`, `src/themes/`,
    `THEME_PACK_GUIDE.md`, ThemePicker), the cast-to-TV display mode, the v1 host
    screen and every host component except three keepers, all v1 stores
    (`gameStore`/`gameSession`/`claimStore`/`settingsStore`/`ticketSetStore`), sound +
    TTS, reduced-motion setting, `relativeTime`, `RUNBOOK.md`, `UI_INVENTORY.md`.
  - Dropped deps: `motion`, `@fontsource-variable/fraunces`.
  - Kept: `src/engine/*` untouched (rng, caller, ticket, ticketId + tests) — the
    seeded "ticket ID is a recipe" idea is what makes room codes work; `player/marks.ts`;
    `QrCode` / `TicketFace` / `PrintSheet` (moved to `src/conductor/`, restyled plain).
  - Added: `src/routes.ts` (all four URLs + ticket-URL helpers, replaces `ticketLink.ts`),
    three-way entry split in `main.tsx` (home / conductor / player), `home/HomeScreen`
    (two doors), `conductor/ConductorApp` (stub), `conductor/storage.ts` (generic
    `tambola:room:*` localStorage + test), `player/JoinForm` (room code + seat number →
    `/t#ID`, pure string work, no lookup), plain `index.css` design base.
  - `player/PlayerApp` rewritten plain; marking is now tap-to-toggle (was long-press to
    unmark); `TicketCell` no longer uses `motion`.
  - `airgap.test.ts` updated for the new graph: allowlist is engine + `player/*` +
    `routes.ts`; conductor entry is now `conductor/ConductorApp.tsx`; `conductor/`,
    `store/`, `home/`, `ui/` are all forbidden inside the player's graph.
  - Docs: `PRD.md` + `ROADMAP.md` written, `CLAUDE.md` + `PROGRESS.md` rewritten,
    caveman rule files added for other agents (`AGENTS.md`, `.cursor/rules/caveman.mdc`,
    `.windsurfrules`, `.clinerules`, `.github/copilot-instructions.md`).

- **P1 engine for the new rules** (branch `major-changes`).
  - Added `engine/patterns.ts`: logical 3×5 grid (cell = `row * 5 + position`, 0–14),
    `Pattern = { cells, required }`, `Condition = { id, name, pattern, points }`, the six
    presets, `makePattern` (normalises editor input), 15-bit pattern mask encode/decode,
    `defaultConditions()` (a split that already totals 100), `pointsTotal` /
    `pointsProblem`.
  - `verifyClaim` now takes a `Pattern`, not a `Dividend` enum — the `Dividend` type is
    gone. One code path for presets and custom conditions: "enough of the pattern's
    cells are marked". `patternNumbers` is the logical-grid → printed-ticket mapping.
    `ClaimResult` gained `required`.
  - Added `engine/base32.ts` — the Crockford alphabet and its look-alike folding, lifted
    out of `ticketId.ts` so the room code and the ticket ID can't drift apart.
  - Added `engine/room.ts`: `RoomConfig`, 25-bit `randomSeed`, room code
    (`formatRoomCode` / `parseRoomCode`) and the QR config blob (`encodeRoomConfig` /
    `decodeRoomConfig`, base64url, versioned), plus `hasCustomConditions`.
  - Tests: `patterns.test.ts`, `room.test.ts`, `ticket.test.ts` rewritten for patterns
    (adds custom-pattern and any-N cases, and a 200-ticket check that every logical cell
    resolves). Airgap allowlist gained `engine/base32.ts` + `engine/patterns.ts`.
  - Nothing wired into a screen yet — P1 is engine only. Suite: 80 tests, lint and build
    clean.

- **P2 conductor setup + distribution** (branch `major-changes`).
  - `conductor/ConductorApp` is now the flow shell: loads the saved room on mount, and
    swaps between setup and distribution in plain state (no router — the only real
    navigation in this app is between bundles, and that is a page load).
  - `conductor/SetupScreen` — room name, players, tickets each, seed (shown as the 5
    base32 characters the conductor reads out, with a "New" button; typing an old seed
    deals the same tickets again). Problems are listed once, under a disabled button.
  - `conductor/ConditionsEditor` — presets on/off with points, custom conditions with
    points and remove, live `points / 100` total, and the D1 warning when custom
    conditions exist. `conductor/PatternEditor` — name + the 3×5 logical grid + "numbers
    needed", so "any N of these cells" is a normal condition, not a special case.
  - `conductor/DistributionScreen` — room code big, the prize list, one QR per seat with
    a "given out" toggle, 6 per page, print sheet, and a disabled "Start calling numbers"
    (P3). "Start a different room" asks first.
  - `conductor/room.ts` — the saved room (`{ config, issuedSeats }`) under
    `tambola:room:setup`, versioned, with `parseStoredRoom` validating whatever comes
    back out; seat helpers (`ticketCount`, `playerOfSeat`, `formatSeat`).
  - `routes.ts` gained the room half of a /t fragment: `#<ticketId>~<encoded room>`.
    `ticketIdFromHash` ignores it, `roomFromHash` returns it; the player screen reads it
    in P4. Tested in `routes.test.ts`.
  - `randomSeed` now only draws seeds that write as five base32 characters, so the room
    code and the ticket IDs show the same seed instead of `0034Z` vs `34Z-00`.
  - `player/JoinForm` now parses a real room code (`parseRoomCode`) instead of gluing the
    typed text onto a seat number — without this, the full code the conductor's screen
    shows ("TQTE1-ZH8F3RY50") was rejected by the join form. Airgap allowlist gained
    `engine/room.ts` accordingly; it is pure string work with no way to reach a conductor.
  - Airgap test now strips comments before the `tambola:marks:` scan — `conductor/
    storage.ts` explains that rule and names the prefix to do it, and it entered the
    conductor's graph the moment ConductorApp started saving anything.
  - Suite: 98 tests, lint and build clean. Walked in the browser: setup → custom
    condition → create → distribution → issue toggle → reload → edit; and join by typed
    room code → the right ticket.

- **P3 conductor live game** (branch `major-changes`).
  - `conductor/game.ts` — the live game (`{ callSeed, history, rulings, ended }` under
    `tambola:room:game`, versioned, validated on load), plus the pure readers the
    screens share: `winnerOf`, `hasBogeyed`, `bogeyCount`, `openConditions`,
    `seatScores`, `allConditionsWon`, `isFrozen`.
  - **The history is a prefix, not a log.** `engine/caller.ts` gained `drawOrder(seed)`
    — the whole 90-number order up front — so drawing is "take one more of it", undo is
    "take one fewer", and the two can't disagree. Loading checks the saved history still
    IS that prefix; anything else is discarded rather than resumed. `replayCaller` did
    this job for a stateful Caller and had no consumer left, so it went.
  - `conductor/CallerScreen` — the called number big, draw / undo, "n called · m left",
    the previous six, the 90-board, the conditions panel (open / won by seat / points),
    the bogey tally, end the game. Holds a wake lock while mounted.
  - `conductor/ClaimVerifier` — seat number *or* ticket ID (a ticket from another room's
    seed is rejected by name), condition, VALID / BOGEY with the missing numbers, then
    an explicit confirm. Won conditions leave the list; a seat that bogeyed a condition
    can never win it (PRD §7.3), and the screen says so instead of offering the button.
  - `conductor/ResultsScreen` — points per seat, best first, what each won, bogeys, the
    conditions nobody took, and "play again with these tickets" (same tickets, same
    split, new draw).
  - `ConductorApp` is now the four-phase shell: setup → distribution → caller → results,
    picked with plain if/else. **The rules freeze at the first draw** — from then on the
    distribution screen offers "Back to the game" instead of "Edit the setup", and
    `handleSave` refuses anyway.
  - `index.css` gained `.callout`, the one size outside the four-step scale: the number
    just called is read from across a room, not at reading distance.
  - Cleanup in the same pass: dropped the unused `zustand` dependency and the unused
    `tambola:room:claims` storage key (rulings live inside the game record), moved
    `useWakeLock` into `conductor/` where it belongs, and taught `vite.config.ts` to
    honour `PORT` so the dev-preview runner and Vite agree on a port.
  - Suite: 116 tests, lint and build clean. Walked in the browser: start calling → draw
    → undo → reload mid-game (resumes) → VALID claim → BOGEY claim with missing numbers
    → frozen setup → end → results → play again.

## Next

- **P4 player journey** — join by QR link and by room code, the ticket screen, call-a-win
  (records intent, transmits nothing), self-recorded outcome, the prize section.
  `routes.ts` already carries the room half of a `/t` fragment for this. See `ROADMAP.md`.

## Key decisions (don't relitigate)

- **THE AIRGAP is structural**: player is its own bundle, `airgap.test.ts` walks its
  import graph and must pass. Navigation between bundles is plain `<a href>` — a
  client-side router would merge the graphs.
- **Ticket ID = recipe.** `K3P9Z-04` regenerates the exact grid anywhere, with no
  server. The room code is that seed; room code + seat number = ticket ID. This is why
  joining by code needs no backend.
- **Custom winning patterns are defined on the 3×5 logical grid** (row × nth number in
  that row), never the 3×9 printed grid — the printed columns differ ticket to ticket,
  so a pattern drawn there would be unsatisfiable on some tickets.
- **Points are out of 100** so they read directly as a percentage of whatever was
  pooled physically. The app shows points only, never money.
- **D1 (resolved, PRD §12):** QR links carry the full room config; a typed room code
  carries the seed plus preset conditions and their points. Custom conditions travel by
  QR only, and the setup screen says so.
- **Room code layout (P1):** 5 characters of seed (fixed width, 25 bits — which is what
  lets the two halves be split by position, so the hyphen is cosmetic), then a payload
  of a 6-bit preset mask plus 7 bits per active preset *except the last*, whose points
  are derived as "the rest of 100". All six presets on = 9 payload characters, i.e.
  `K3P9Z-1A2B3C4D5`. Longer than the "8–10 characters" sketch in PRD §12; the way to get
  it shorter was to quantise points to multiples of 5, and a real product restriction
  isn't worth two characters.
- **PRESETS order is a wire format.** The room code's mask is positional, so the array in
  `patterns.ts` is append-only — reorder it and every printed code decodes a different
  game. `patterns.test.ts` pins the order.
- **Early Five is not a special case.** A pattern carries `required`, so Early Five is
  "the whole grid, need 5" and Full House is "the whole grid, need 15". One verification
  path, and custom "any N of these cells" conditions come free.
- **A game is a pointer into a fixed order** (P3). The draw order is decided by
  `callSeed`; what gets saved is how far along it we are. Undo is a slice, and a saved
  history that isn't a prefix of that order is corrupt by definition.
- **The draw seed is not the ticket seed** (P3). The same set of tickets can be played
  twice in an evening, and must not repeat the same draw when it is.
- **A seat number IS the ticket's index**, so seats run 00…N-1 and seat 04 of room K3P9Z
  is the ticket printed `K3P9Z-04`. Starting at 01 would have made the two disagree in
  the exact place people are already squinting — the conductor can type either.
- **Code-joiners see no trace of custom conditions** (not "Custom 1/2/3" as PRD §12 first
  sketched). A name is what makes a condition callable out loud; an unnamed row is noise.
  The setup and distribution screens both say so plainly.
- **QR links carry the whole room** (`#<ticketId>~<blob>`), which makes them dense — hence
  148px per code on the distribution list. Anything smaller is a QR a phone can't read.
- **D2 (resolved):** the conductor's ledger is the source of truth; the player's prize
  screen is a copy they maintain themselves. No channel, by design.
- **D3 (resolved):** Capacitor / `android/` stays in the repo, parked and unbuilt.
- Storage prefixes are disjoint: player `tambola:marks:`, conductor `tambola:room:`.
- `generateSet` gives distinct tickets, not the traditional book-of-6 partition of 1–90.
