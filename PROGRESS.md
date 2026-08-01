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

- **P6 house-rule extensions** (branch `major-changes`) — from friend playtesting.
  - `engine/ticket.ts` gained `completionCall(ticket, history, pattern)`: which call
    the pattern FIRST became satisfied on, or null. `verifyClaim` answers "does this
    hold now", which is all a lenient room needs; the strict house rule also needs
    "and how long has it been holding?".
  - `RoomConfig.strictClaimTiming` — the late-claim toggle, off by default, set under
    a new "House rules" section on the setup screen. **Neither carrier carries it**:
    it is a rule about how the CONDUCTOR rules, the ruling happens entirely on the
    conductor's device, so it stays out of the room code and the QR blob and the
    conductor announces it out loud. `parseStoredRoom` reads it tolerantly (a room
    saved before the field existed defaults to off rather than being discarded).
    When it is on, the verifier adds one line to a VALID result — "Late: complete
    since call 31, 14 numbers ago" or "On time" — and nothing else. The conductor
    still presses the button; the app reports a fact, never a verdict.
  - **Ties.** `winnerOf` became `winnersOf` (seats, de-duplicated) plus `isOpen`;
    `splitPoints(points, seats)` divides evenly with the remainder going to the
    lowest seat numbers. `SeatScore.won` is now `SeatWin[]` (`{ condition, points,
    sharedWith }`) so the results screen shows the share rather than the condition's
    face value. Re-checking a seat that already won it says so and offers no win
    button: a seat cannot split a prize with itself.
  - **The tie window is one number wide** (`canTie`, added after playtesting — the
    first cut let a condition be tied into at any point after it was won, which is
    wrong: a tie is what happens when there was *no* first). `Ruling.atCall` already
    recorded how many numbers were out when a ruling was made, so "same number" is
    just that count still matching the board. A condition won on an earlier call
    drops out of the verifier's list entirely. The window can shut *mid-claim* — a
    draw between checking a ticket and ruling on it — so `ClaimVerifier` reads tie
    eligibility live from props rather than freezing it into `pending`, hides the tie
    button, and says which call it was won on instead of silently greying out.
    `parseRulings` enforces the same invariant on load: all of a condition's valid
    rulings must share an `atCall`, or the record was hand-edited and is discarded.
  - **"Another"** on each active preset row mints `fullHouse-2` / "Full House 2" with
    its own points. No engine change: that id isn't a preset id, so every existing
    path already treats it as a custom condition — QR-only, skipped by
    `formatRoomCode`, counted by `hasCustomConditions`. Id minting takes the highest
    suffix in use, not the count, so removing "Full House 2" can't mint an id that
    "Full House 3" still holds.
  - **Bug found and fixed while walking P6** (pre-existing, but "Another" makes it one
    tap away): the room code encoded points for every active preset *except the last*
    and derived that one as "the rest of 100". A room's split only totals 100 across
    ALL conditions, though — so any points sitting on a condition the code can't carry
    were silently absorbed into the last preset, and a code-joiner read "Full House 35
    pts" where the conductor's ledger said 25. All six are now written out explicitly
    and the decoder accepts any total up to 100. Costs exactly one more character
    (`CF3V9-ZH8F3RY50` → `CF3V9-ZH8F3RY534`); the old test only checked which ids
    survived, never their points, which is why it never caught this.
  - Suite: 146 tests, lint and build clean. Walked in the browser at 375×812: setup
    with a second Full House and the strict rule on → 100/100 → call 45 numbers →
    check a claim (BOGEY, no timing line since it was never complete) → check again
    (VALID + "Late: complete since call 31, 14 numbers ago") → record → tie a second
    seat (5/5 preview) → tie a third (4/3/3, remainder to seat 00) → re-check seat 00
    ("already won", no win button) → results show shares and who each was tied with →
    reload (tie survives) → join by typed code: presets only, Full House reads 25.
    No console errors.

- **P7 the player's side of a split** (branch `major-changes`) — closes the gap P6
  left open.
  - `player/claims.ts`: a claim is now `{ state, winners }`, not a bare state string.
    `loadClaims` still reads the old bare string, as `winners: 1` — that is exactly
    what it meant — so a player whose phone updates mid-game keeps their notes rather
    than losing them. A stored winner count outside 1..8 is clamped, not trusted.
  - **The share is a range, not a figure.** This phone knows how many ways a prize
    went (the player heard it) but not WHICH seats, and the odd point on an uneven
    split follows seat order — so `formatShare` gives "17–18 pts" where it can't
    divide and "15 pts" where it can. `pointsWon` returns `{ low, high }` for the
    same reason. Guessing a single number would be wrong about half the time, and the
    conductor's results screen is the ledger anyway (D2).
  - `player/PrizeList` — a won row carries "Shared — N ways" (a `.field` select, no
    third button look) and the range; the explanation appears only once a range is
    actually on screen. `withClaim` gained an optional `winners` so recording a state
    and changing the split are separate edits that don't clobber each other.
  - Caught while wiring it: `TicketScreen`'s prop type and `PlayerApp.setClaim` both
    took two arguments, so the new third one would have been **silently dropped** —
    TypeScript accepts a narrower function where a wider one is expected, so nothing
    failed to compile. Both widened.

- **P8 what a typed code can carry, and giving a seat out once** (branch `major-changes`)
  — from playtesting.
  - **"Another" prizes now ride in the room code.** The reported bug was "change the
    winning conditions before the game starts and the QR updates but the code doesn't":
    true whenever the change was a custom condition, since a code carried presets only.
    The reason D1 gives for that is NAMES — free text doesn't compress into something
    shoutable — and a copy has no typed name. `fullHouse-2` / "Full House 2" is
    generated from a preset every build already knows, so all the code has to carry is
    which preset, which number and how many points.
  - `engine/patterns.ts` gained the copy vocabulary in one place — `presetCopyId`,
    `presetCopyName`, `presetCopy`, `parsePresetCopyId`, `MAX_PRESET_COPY` — so the
    setup screen and the room code can't mint "Full House 2" two different ways.
    `ConditionsEditor` now builds copies with it instead of its own string glue.
  - Room code layout gained a tail: after the preset points, a 1 bit means "another
    copy follows", then 3 bits of preset index, 2 bits of copy number (2..5) and 7 bits
    of points; a 0 bit ends the list. **An old code decodes unchanged and a copy-less
    room writes the exact same characters** — the terminating 0 lands where the old
    format's zero padding already was, which `room.test.ts` pins with a literal code
    from the previous build. Each copy costs about three characters.
  - `hasCustomConditions` became `uncarriedConditions(conditions)`, which returns the
    conditions a code genuinely can't carry — hand-drawn patterns, and copies past
    `MAX_PRESET_COPY`. Both warnings now NAME them ("A typed code can't carry
    Diagonal") instead of lumping a second full house in with them.
  - **The player is told what's missing, without carrying it.** A split always totals
    100, so `TOTAL_POINTS - pointsTotal(conditions)` IS the points sitting on prizes
    the link couldn't name. `TicketScreen` says so in one line. Free — no bits, no
    channel — and it beats a prize list that quietly adds up to 90.
  - **A seat given out stops being offered.** The distribution row used to keep its QR
    next to a "Given out" toggle, which is exactly how one ticket reaches two people.
    Now the QR is replaced by a same-size "Given out" box, the toggle becomes a
    `.btn-inline` "Undo", and given seats drop out of the print sheet ("Print the 11
    not given out", disabled at zero). Undoing puts both back.
  - Suite: 165 tests, lint and build clean. Walked in the browser at 375×812: edit a
    room mid-distribution → "Another" full house → code grows to `FFX6X-ZJGF3RY51Z850`
    → join by that typed code shows "Full House 2 · 10 pts" → add a hand-drawn
    "Diagonal" → both warnings name only Diagonal → join by code shows the other seven
    prizes plus "also playing for 10 points' worth of prizes this link couldn't name" →
    mark a seat given (QR gone, Undo shown, print button drops to 11). No console
    errors.

- **P9 undo and ruling integrity** (branch `major-changes`) — the first of the four
  pre-launch correctness phases.
  - **Undoing a draw underneath a ruling no longer eats the game.** `handleUndo`
    shortened `game.history` and left `game.rulings` alone, so a ruling's `atCall` could
    end up ahead of the history — which `parseRulings` correctly rejects, taking
    `parseStoredGame` to null and the conductor back to distribution with the whole game
    gone and the rules unfrozen. Nothing showed it until the next load, i.e. the next
    time a party conductor's phone locked. `canUndoDraw` (`conductor/game.ts`) now
    refuses while any ruling was made on the number about to go, `CallerScreen` disables
    the button and says why, and `handleUndo` re-checks so a stale tap can't slip past.
  - **A ruling can be taken back.** `withoutRuling(game, index)` plus
    `handleUndoRuling` and a "Recent rulings" list on `CallerScreen` — last six, most
    recent first, seat + condition + Won/Bogey + which call, and a `.btn-inline` "Undo"
    per row behind a confirm. Undoing reopens a condition, releases a tie back to its
    other winner, or clears a bogey so the seat is eligible again. Until now the
    conductor's ledger — the one that decides how the pot gets split (D2) — was the only
    ledger in the app with no way back from a slip; the player's own prize list has had
    undo on every row since P4.
  - The two fixes are one feature: the blocked undo tells you to undo the ruling first,
    and doing that frees the draw. `withoutRuling` ignores an index that isn't a row
    rather than dropping the last one, which is what a bare `filter` on a stale index
    would have done.
  - Suite: 176 tests, lint and build clean. Walked in the browser at 375×812: start a
    game → draw 4 → record a bogey on call 4 → undo-draw disabled with the reason →
    reload (game resumes, still blocked) → undo the ruling behind its confirm → bogey
    list and the block both gone → undo the draw → reload (3 called, game intact). No
    console errors.

- **P10 offline reliability** (branch `major-changes`) — the second pre-launch
  correctness phase.
  - **Offline only ever worked at `/`.** `sw.ts` precached every built file and stopped
    there, but Workbox's precache route only matches URLs that are IN the manifest, and
    `/t`, `/join` and `/conduct` are not files — they're SPA paths that `vercel.json`
    rewrites to `index.html` **at the server**. With no signal there is no server to do
    that rewrite, so a scanned QR opened cold got a network error, contradicting both
    `sw.ts`'s own header comment and CLAUDE.md's "offline-capable".
  - Fix: `registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))` —
    the offline half of the same rule `vercel.json` applies online. Only navigations
    match, and the handler serves a file already in the precache, so the worker is still
    precache-only: it fetches nothing new and relays nothing between clients, which is
    what `airgap.test.ts`'s service-worker check cares about.
  - `workbox-routing` added as an explicit devDependency. It was already on disk as a
    transitive of `workbox-build`; depending on it by name means a hoisting change can't
    quietly take the fallback away.
  - No vitest coverage: Workbox's navigation matching is a browser-only API, and a unit
    test would only be asserting that we called a function we can see we called.
  - Suite: 176 tests (unchanged — this phase adds no testable pure code), lint and build
    clean. Verified in the browser against the real production build: load `/` once with
    the preview server up (service worker installs, 17 precache entries, `index.html`
    among them) → **stop the server** → cold-navigate to `/t#K3P9Z-04` (the ticket
    renders, seat 04's real grid) → cold-navigate to `/conduct` (setup screen renders).
    Neither path had ever been visited online, so nothing but the new navigation route
    could have served them. No console errors.

- **P11 live-game ergonomics** (branch `major-changes`) — the third pre-launch phase.
  - **The caller screen no longer loses the called number mid-claim.** `ClaimVerifier`
    sits below the board and the conditions panel, so checking a claim scrolled the
    just-called number off the top — the one number everyone in the room is also
    looking at, at the moment it is being argued about. `CallerScreen` now watches the
    callout card with an `IntersectionObserver` and renders `.call-bar` (number, "Just
    called", numbers left) only once that card has actually gone. Layout only: no
    colour, no motion, no new type size — the bar reuses `.label` / `.title` /
    `.muted`.
  - **Fixed, not sticky.** A sticky element reserves its space at its natural position
    (the top of the document), so mounting one part-way through a scroll shoves the
    page down under the conductor's thumb. `position: fixed` costs an overlay across
    the top ~44px of whatever is being scrolled past, which is the cheaper of the two.
  - **A page of tickets goes out in one action.** `DistributionScreen` handed seats out
    one tap at a time, which is five pages of individual taps in a 30-player room while
    everybody stands there. A "Mark N on this page given" button now covers the seats on
    screen that haven't gone yet, behind the same inline confirm as "Start a different
    room" — the two are the same kind of change, several seats at once with only a
    one-at-a-time way back. Offered from two seats up; below that the row's own "Mark
    given" is already the shorter path, and turning the page abandons an open confirm
    rather than carrying it to seats it wasn't asking about.
  - `conductor/room.ts` gained `withSeatsIssued(issuedSeats, seats)` — the pure half,
    sorted and de-duplicated exactly the way the single-seat toggle keeps the list. It
    only ever ADDS: there is no bulk undo, because un-giving a page is the one action
    that could put a seat somebody already walked away with back on screen.
  - Suite: 178 tests, lint and build clean. Walked in the browser at 375×812: a 14-seat
    room → "Mark 6 on this page given" → confirm → all six lose their QRs, print drops
    to "the 8 not given out" → page 3 offers "Mark 2" → open the confirm, turn the page,
    confirm is gone and nothing was marked → reload (7 of 14, stored seats sorted) →
    start calling → draw → scroll to the verifier (the bar appears with the number) →
    scroll back (the bar goes, no duplicate). No console errors.

- **P12 optional seat labels** (branch `major-changes`) — the last pre-launch phase.
  - `StoredRoom` gained `seatNames: Record<number, string>`, saved and loaded exactly the
    way `issuedSeats` already is. **Conductor-side only**: it is not part of `RoomConfig`,
    so it rides in neither carrier — not the room code, not the QR blob — and the player's
    bundle has no idea it exists. No airgap impact, no carrier change; it is a private
    note about a seat number the conductor already controls.
  - `room.ts` gained `withSeatName` (the pure edit), `seatLabel` ("Priya · seat 04",
    falling back to "Seat 04") and `seatLabelInline` — the same label mid-sentence, where
    a capital S would read as a new sentence ("tied with priya · seat 04").
    **The seat number never goes away**, name or not: it is what is printed on the ticket
    in the player's hand, and two people at a party can be called the same thing.
  - Wired into every conductor-side place a seat is shown: `DistributionScreen` (a "Who
    has this ticket (optional)" field per row, full width under the QR — the right-hand
    column is ~150px on a phone), `CallerScreen`'s conditions panel, recent rulings and
    bogey list, `ClaimVerifier` (header, both "already" lines, the tie preview and the
    tie-window-shut line), and `ResultsScreen`, which is the one that actually matters —
    it is what gets read out when it is time to split what got pooled.
  - The recent-rulings row and the verifier's header now separate seat from condition
    with an em dash rather than "·": a named seat is already "Priya · seat 04", and a
    third dot in one line stops reading as a separator.
  - **Names are not frozen with the rules.** They are reachable mid-game through "Back to
    the tickets" on purpose — somebody turning up late still needs naming, and a label is
    not a rule.
  - Caught in the browser walk: trimming the typed value on every keystroke made
    two-word names impossible — the space in "Priya K" was eaten the moment it was
    typed, so the surname could never be started. `withSeatName` now caps but does not
    trim (whitespace-only still clears the seat), and `parseStoredRoom` trims on the way
    back in, so a stray trailing space lives no longer than the next reload.
  - `parseStoredRoom` reads names tolerantly, same as `strictClaimTiming`: a room saved
    before the field existed loads with none rather than being discarded, non-string
    entries and names for seats the room no longer has are dropped, and `handleSave`
    drops them on shrink the same way it already drops stranded issued seats.
  - Suite: 189 tests, lint and build clean. Walked in the browser at 375×812: a 4-seat
    room → name seats 00 and 01 → draw 46 → check seat 00's Early Five ("PRIYA · SEAT 00
    — EARLY FIVE", VALID) → record → conditions panel reads "Priya · seat 00 · 10 pts"
    and the condition list offers "tie open with Priya · seat 00" → bogey seat 01 →
    recent rulings and the bogey tally both name them → results read "Priya · seat 00 —
    10 pts" → reload (names survive) → clear a name (the entry goes, the row falls back
    to "Seat 00") → retype "Priya K" (the space survives). No console errors.

## Next

- Nothing queued. P9–P12 were the pre-launch correctness phases and all four are built.
- Beyond that: `ROADMAP.md` under "Later" — design system, native build, backend — none
  of it starts without a decision to start it.

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
- **D1 (resolved, PRD §12; widened in P8):** QR links carry the full room config; a typed
  room code carries the seed, the preset conditions and their points, and any "Another"
  copy of a preset. What a code cannot carry is a NAME THE CONDUCTOR TYPED — that is the
  whole of the restriction, so a hand-drawn pattern stays QR-only while a generated
  "Full House 2" travels. Both conductor screens name what won't travel, and the player's
  screen reports the leftover points (100 minus what arrived) so the list still adds up.
- **Room code layout (P1, revised in P6):** 5 characters of seed (fixed width, 25 bits —
  which is what lets the two halves be split by position, so the hyphen is cosmetic),
  then a payload of a 6-bit preset mask plus 7 bits per active preset. All six presets
  on = 10 payload characters, i.e. `K3P9Z-1A2B3C4D5E`. Longer than the "8–10 characters"
  sketch in PRD §12; the way to get it shorter was to quantise points to multiples of 5,
  and a real product restriction isn't worth two characters.
  - P6 dropped the original saving of deriving the LAST preset's points as "the rest of
    100". A split totals 100 across every condition, not across the presets alone, so
    the derived value quietly swallowed the points of everything a code can't carry.
    One extra character buys a number that matches the conductor's ledger.
  - P8 appended a copy list: a 1 bit before each copy (3 bits preset index, 2 bits copy
    number, 7 bits points) and a 0 bit to end it. A room with no copies writes exactly
    the same characters as before, because that terminating 0 sits where the padding
    already did — so the change reissues nothing.
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
- **Code-joiners see no trace of a condition whose name can't travel** (not "Custom
  1/2/3" as PRD §12 first sketched). A name is what makes a condition callable out loud;
  an unnamed row is noise. They ARE told how many points those prizes are worth (P8),
  because that much is derivable from the split totalling 100 and costs nothing to send.
- **A seat can only be given out once** (P8). Marking a seat given takes its QR off the
  screen and its ticket off the print sheet, rather than leaving both there under the
  word "Given out". The issue list has no backend behind it — it is the only thing
  stopping one ticket reaching two people, so it has to actually stop it. Undo is the
  single way back, and it is deliberately the smaller control of the two.
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
- **"Two full houses" is two conditions, not one condition with two winners** (P6). Each
  prize has its own name, its own points and its own winner — which is exactly what a
  `Condition` already is, so "Another" needed no engine change at all. A tie is the
  genuinely different thing: ONE prize, several winners, points divided.
- **The strict-timing rule reports, it does not rule** (P6). The verifier says which call
  the ticket completed on; the conductor decides what that is worth, out loud. Same
  reason the app never announces a win — see rule 2.
- **A tie's remainder goes to the lowest seat numbers** (P6). Something has to break the
  last point, and seat order is the one tiebreak that is fixed before the game starts and
  visible to everyone, so nobody can argue it was decided after the fact.
- **A tie only counts on the number it was won on** (P6, revised after playtesting). A
  tie is what happens when there was NO first — both shouted on the same call. One
  number later there was a first, and the slower player simply lost the race, which is
  how a tambola prize is normally decided. So the window is one call wide, it is not a
  setting, and `canTie` is checked live rather than at claim-check time because a draw
  can shut it mid-claim.
- **The player's phone shows a share as a range** (P7). It knows how many ways a prize
  went, never which seats, and the odd point follows seat order — so "3–4 pts" is the
  true answer and a single figure would be a guess. Same D2 reasoning as the rest of the
  player's notebook: the conductor's ledger is what settles it.
- **Undoing a ruling is correcting the record, not reopening a prize** (P9). The app has
  no way to tell a mis-typed seat from a change of mind about a prize somebody fairly
  won, so it doesn't pretend to: one control, one confirm, and the wording says what it
  does rather than why you might be doing it. The alternative — no way back at all — put
  the app's most consequential ledger below the player's own notebook, which has had
  undo on every row since P4.
- **A ruling pins the number it was made on** (P9). `Ruling.atCall` is validated against
  the history on load, so undoing a draw out from under a ruling doesn't produce a wrong
  game, it produces an unloadable one. Blocking the undo (rather than rewriting the
  rulings to fit, or loosening the check) keeps the invariant that made the corruption
  detectable in the first place.
- **The service worker does offline exactly what `vercel.json` does online** (P10). Both
  say "a path with no file behind it is `index.html`" — the host says it while there is a
  host, the navigation route says it when there isn't. Keeping them the same rule in two
  places is what makes a scanned QR work with no signal; a fallback that served anything
  else, or that fetched, would break the precache-only invariant `sw.ts` is built around.
- **Bulk issue only ever adds** (P11). A page can be marked given in one action; there is
  no "un-give this page". Undoing is per seat, deliberately the smaller control, because
  the issue list has no backend behind it — it is the only thing stopping one ticket
  reaching two people (P8), and a bulk undo is the one tap that could put a seat back on
  screen after somebody already walked off with it.
- **A seat name is a conductor's private note, not part of the room** (P12). It lives on
  `StoredRoom`, never on `RoomConfig`, so no carrier grows by a byte and the player's
  bundle cannot learn it — the airgap is untouched because there was never anything to
  send. The seat number stays visible alongside the name everywhere, because the number
  is what is printed on the ticket in the player's hand. Names are also editable
  mid-game, unlike the rules: a label is not a rule, and late arrivals still need one.
- **A typed room code cannot validate that a seat exists** (accepted limitation, found
  in the P9–P12 review, not fixed). The code carries no ticket count by design (D1) —
  giving it one would spend characters catching a typo that already gets caught, just
  later, at the conductor's `ClaimVerifier` ("This room only goes up to seat NN"). A
  mistyped seat number opens a real, fully playable ticket that simply can never be
  claimed. Left as-is on purpose rather than bent to fix.
