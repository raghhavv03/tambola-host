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

## Next

- **P1 engine for the new rules** — conditions as patterns on the 3×5 logical grid,
  `verifyClaim` taking a pattern instead of the fixed dividend enum, room-code
  encode/decode, points validator (must total 100). See `ROADMAP.md`.

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
- **D2 (resolved):** the conductor's ledger is the source of truth; the player's prize
  screen is a copy they maintain themselves. No channel, by design.
- **D3 (resolved):** Capacitor / `android/` stays in the repo, parked and unbuilt.
- Storage prefixes are disjoint: player `tambola:marks:`, conductor `tambola:room:`.
- `generateSet` gives distinct tickets, not the traditional book-of-6 partition of 1–90.
