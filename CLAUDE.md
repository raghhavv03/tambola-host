# Tambola

## What this is

An app for running a **physical** tambola (housie) game — a party, an office event, a
family gathering. One person **conducts**: they set up the room, hand out tickets, tap
to draw numbers 1–90 and call them out loud, and rule on claims. Everyone else
**plays**: they get a ticket on their own phone (or on paper), mark it themselves, and
shout when they complete a pattern.

Two journeys, one app. `PRD.md` is the spec. `ROADMAP.md` is the plan. `PROGRESS.md` is
the state — read all three before building.

**This iteration has no design system on purpose.** White background, black text, black
buttons, grey borders. Consistent sizing, spacing and positioning; no colour system, no
animation, no theme. Design lands in a later pass and must not require a rebuild.

## Response style

Caveman mode is always on in this repo — see `AGENTS.md`. Chat replies are terse; code,
comments, commits and docs are written normally.

## Non-negotiables

1. **Never mark a player's ticket for them.** No auto-mark, no highlight, no hint that a
   number is on their ticket, no "you missed one". If they miss it, they miss it, and
   the app says nothing.
2. **Never announce a win.** Winning conditions are checked only when a player has
   already shouted and the conductor asks the app to check.
3. **No auto-call by default.** The conductor taps to draw.
4. **No money in the app.** No wallet, no balance, no currency field, no pot size, no
   pooling, no payment. Winning conditions carry **points out of 100** — a percentage
   the humans use to split whatever they pooled physically, outside the app. Real-money
   gaming is illegal in India (PROG Act 2025) and we stay well clear of the line.
5. **No third-party IP.**
6. **No backend, auth or database in this iteration.** Everything is local, static,
   offline-capable.

**THE AIRGAP.** The player bundle (`/t`, `/join`) has no channel to the conductor — no
socket, no poll, no fetch, no shared store, no shared module graph. It learns everything
it will ever know from the URL it was opened with, and nothing after that. The
conductor's screen showing a board of numbers already out is CORRECT and traditional;
the player's own ticket cross-referencing that board is FATAL. The line is not what the
app displays — it is **WHO DOES THE MATCHING**, and that stays in the player's head.
This is structural, not a preference: if a task seems to require a channel to the player,
stop and say so.

If a request violates any of these, say so and stop — don't build a "configurable"
version of it either.

## Stack

- Vite 8 + React 19 + TypeScript
- Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config` — v4 configures in CSS;
  entry is `@import 'tailwindcss'` in `src/index.css`)
- Vitest (`npm test`), node environment, config in `vitest.config.ts`
- PWA via `vite-plugin-pwa` (injectManifest). We OWN the service worker `src/sw.ts` —
  precache-only, never relays between clients; `airgap.test.ts` asserts that. It also
  answers navigations with the precached `index.html`, which is the offline half of the
  rewrite below — still precache-only, since it serves a file already cached.
- No backend. No state library yet — add one only when a screen actually needs it.
- **Native:** Capacitor wraps the web build (`android/`, `capacitor.config.ts`) — parked
  and unbuilt this iteration. Players never install anything; they scan a QR or type a
  room code.
- **Deploy:** none of the routes have a file behind them, so a static host must rewrite
  unknown paths to `index.html` or scanned QRs 404. `vercel.json` does this; `vite dev`
  already does it locally; `src/sw.ts` does it when there's no signal at all.

## Structure

```
src/
  routes.ts        URL shapes only. Imported by both bundles — strings, never state.
  main.tsx         Picks ONE of three entry points by pathname, dynamically imported.
  engine/          Pure TS: no React, no app imports, no network, no storage.
                   rng.ts (one seeded PRNG) · caller.ts (draw order) ·
                   ticket.ts (generate + verify) · ticketId.ts (the ticket "recipe" ID)
  home/            The front door: two doors, nothing else.
  conductor/       Setup, distribution, the caller, the verifier, conductor storage.
                   room.ts is the saved setup; game.ts is the game in progress.
  player/          /join and /t. Its own graph. Nothing conductor-side may appear here.
```

The three screens are **separate bundles with separate module graphs on purpose** —
that split is how THE AIRGAP is enforced structurally rather than by good intentions.
Navigation between them is plain `<a href>` (full page loads), because a client-side
router would merge the graphs. `src/player/airgap.test.ts` walks the player's real
import graph and fails the build if it can reach the conductor, the caller, or any
network API. If a change makes that test fail, **the change is wrong, not the test.**

**Ticket IDs are recipes, not database keys.** `K3P9Z-04` means "ticket 4 of the set
grown from seed K3P9Z". Any device rebuilds that exact grid from the string alone. This
is what makes QR distribution, room codes and conductor-side verification work with no
server — the room code IS the seed.

## UI rules for this iteration

- `src/index.css` holds the whole system: one font stack, four type sizes (`.title`,
  `.subtitle`, `.label`, `.muted`), one control height (44px — `.btn`, `.field`,
  `.btn-inline`), one container (`.screen`), one surface (`.card`). `.callout` is the
  single exception, and only the caller screen's just-called number may use it — it is
  read from across a room. `.call-bar` is layout, not a fifth size: it repeats that same
  number in existing sizes once the callout has scrolled off, and only the caller screen
  uses it.
- Two button looks, and only two: `.btn` (a box, optionally `.btn-secondary` /
  `.btn-block`) and `.btn-inline` (an underlined action that lives inside a list row,
  where a box would be bigger than the row it edits — "Undo", "Remove"). Both are 44px
  tall. A third one is a bug.
- Use those classes. Don't invent a fifth type size or a third button look.
- Only two colours mean anything: `.is-valid` (green) and `.is-bogey` (red). Everything
  else is black, white or grey.
- Mobile-first. The conductor is holding a phone and so is every player.

## Working with me

I'm new to this stack. So:

- Comment non-obvious lines — assume I'll read the code to learn from it.
- Prefer boring, readable code over clever code. No dense one-liners, no premature
  abstraction.
- When I ask for something that's a bad idea, tell me directly and say why. Don't
  quietly build it anyway.

## How we work here

- Build features directly, in one pass. No multi-doc spec+plan ceremony, no subagent
  handoffs, no `superpowers` skill chain. Just build it.
- Tests where they earn it: the engine, the encoders and the airgap get real tests.
  Components are verified by build + lint + a browser check — don't write React
  component unit tests, don't over-test, don't churn tokens.
- Keep it simple. Boring code, sharp result.

### End of every iteration (not optional)

1. Run the tests that the change actually touches, plus `npm run lint` and
   `npm run build`. Nothing more — no test written to pad the count.
2. Check the change in the browser if it's visible.
3. Update the docs the change invalidates: `PROGRESS.md` always, `PRD.md` /
   `ROADMAP.md` / this file when the change alters the plan or the rules.
4. Report plainly: what was built, what passed, what didn't, and **whether the code is
   ready to commit**. If something is half-done or a test fails, say so — don't round up.
