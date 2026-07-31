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

- **P4 player journey** (branch `major-changes`).
  - `player/storage.ts` — the player's own localStorage plumbing, under two prefixes:
    `tambola:marks:` (their taps, unchanged) and `tambola:player:` (everything added
    here). `marks.ts` now goes through it and gained `clearMarks`.
  - `player/wallet.ts` — the tickets this phone has opened (`tambola:player:tickets`),
    most recent first, capped at 12. This is what makes **multiple tickets on one
    phone** work: the URL fragment only ever describes one ticket, so without a list
    the second scan would lose the first. `withTicket` is the pure half, so a
    freshly-opened ticket appears in the switcher without a write during render.
  - `player/claims.ts` — the player's self-recorded outcomes per ticket
    (`tambola:player:claims:<ticketId>`): `claimed` (shouted, waiting) → `won` /
    `bogey`. Plus `withClaim` and `pointsWon`. Nothing here verifies anything and it
    must never learn how — the ruling happens on the conductor's device, out loud.
  - `player/TicketScreen` — room name (QR joiners only), ticket ID, the ticket
    switcher, the grid, then the claim panel and the prize list. `player/ClaimPanel`
    — "Call it" writes a note on this phone and says **shout**; the outcome buttons
    record what the conductor ruled. `player/PrizeList` — won / bogey / running total,
    each undoable, because a mis-tap on a self-recorded ledger is otherwise permanent.
  - `PlayerApp` is now the shell: fragment → session (ticket, room, marks, claims),
    the hashchange listener that swaps ticket, persistence, and "remove this ticket"
    (which takes that ticket's marks and claims with it). A fragment whose ticket code
    doesn't parse is *not* remembered, so a mistyped URL can't clutter the switcher.
  - `JoinForm` now re-encodes the presets a typed room code carried into the same blob
    a QR uses, so `/t` has one decode path. A code carries no room name and no custom
    conditions — that is D1, unchanged.
  - `routes.ts` gained `ticketFragment` (the `#<id>~<room>` half of `ticketUrl`), which
    is what the ticket switcher and the post-removal jump both build links with.
  - Airgap: allowlist gained the five new player files; the conductor-side key test now
    checks both player prefixes, not just `tambola:marks:`.
  - Suite: 130 tests, lint and build clean. Walked in the browser: setup (2 tickets
    each) → join by typed code → call a win → won → bogey → open a second ticket by QR
    fragment (room name shows) → reload → switch tickets (marks and prizes stay with
    their own ticket) → remove a ticket → bad fragment shows the error and is not saved.

- **P5 consistency pass** (branch `major-changes`).
  - `index.css` gained `.btn-inline` — the second and last button look. Two screens had
    each grown their own anonymous `muted underline` text button (`PrizeList`'s "Undo",
    `ConditionsEditor`'s "Remove"); both were ~21px tall, i.e. under the 44px floor every
    other control in the app holds to. One named class now covers both, at 44px.
  - Type scale enforced where raw Tailwind sizes had crept in: the distribution screen's
    room code was a hand-rolled `text-2xl font-bold` (the same 24/700 `.title` already
    defines) and the player's ticket ID was a bare `text-sm` (the same 14px `.muted`
    already defines). Both now name the class.
  - "Seat NN" was `.title` on the distribution list and `.subtitle` on the results
    screen. Now `.subtitle` in both — a row label in a list is not a page title.
  - **Back navigation everywhere.** `/t` had none: the player's ticket screen and the
    bad-link screen were the only two in the app with no way to the front door. Both
    now carry the same `← Home` link the conductor and join screens already had.
  - One grey for hairlines: `PrizeList`'s total separator was `neutral-200` against the
    `neutral-300` every card border uses.
  - Suite: 130 tests, lint and build clean. Walked in the browser at 375×812, both
    journeys end to end: home → conduct → distribution (room code, QRs, issue list) →
    edit setup → add a custom condition → points over 100 blocks Save → cancel → start
    calling → draw → verify a claim (BOGEY with missing numbers, then VALID) → record
    the win → end → results; and join by typed room code → ticket → call a win → record
    it → undo it → back to home. No console errors.

## Next

- Nothing queued. P0–P5 are done and the branch is a working app on both journeys.
  What comes after is in `ROADMAP.md` under "Later" — design system, native build,
  backend — and none of it starts without a decision to start it.

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
- Storage prefixes are disjoint: player `tambola:marks:` and `tambola:player:`,
  conductor `tambola:room:`. The airgap test fails the build if the conductor's graph
  names either player prefix — localStorage is same-origin, so the test is the fence.
- **The player's prize screen is their own notebook** (P4). They tap what they heard the
  conductor rule, and they can undo it. It can disagree with the conductor's ledger, and
  that is the accepted price of having no channel — D2, taken on purpose.
- `generateSet` gives distinct tickets, not the traditional book-of-6 partition of 1–90.
