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

## Next

- **P2 conductor setup** — room name / player count / tickets per player / seed, the
  condition picker (presets on-off, custom pattern editor on the 3×5 grid, live points
  total blocking Start until it hits 100), distribution screen, config persisted to
  `tambola:room:setup`. See `ROADMAP.md`.

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
- **D2 (resolved):** the conductor's ledger is the source of truth; the player's prize
  screen is a copy they maintain themselves. No channel, by design.
- **D3 (resolved):** Capacitor / `android/` stays in the repo, parked and unbuilt.
- Storage prefixes are disjoint: player `tambola:marks:`, conductor `tambola:room:`.
- `generateSet` gives distinct tickets, not the traditional book-of-6 partition of 1–90.
