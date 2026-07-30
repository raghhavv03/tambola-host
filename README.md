# Tambola

An app for running a **physical** tambola (housie) game — a party, an office event, a
family gathering. One person conducts; everyone else plays on their own phone or on
paper. The app calls numbers and settles claims. It never plays the game for anyone.

> **v2 in progress.** This branch is a rewrite: themes, the TV display mode and the old
> single-screen host app are gone; two full journeys (conductor and player), joinable
> room codes and configurable winning conditions are going in. See `PRD.md` for the
> spec, `ROADMAP.md` for the plan and `PROGRESS.md` for what actually exists today.

## The two journeys

| Journey | Route | What it does |
| :-- | :-- | :-- |
| Front door | `/` | Pick a journey. |
| Conductor | `/conduct` | Set up a room, hand out tickets, call numbers, verify claims. |
| Join | `/join` | Enter a room code + seat number to get your ticket. |
| Player ticket | `/t#<id>` | Your ticket. Mark it yourself. |

## Rules the code enforces

- **No auto-marking, no hints, no win announcements.** The player does the matching, in
  their head, like they would with a paper ticket.
- **No auto-call.** The conductor taps to draw.
- **No money.** Winning conditions carry points out of 100 — a percentage for splitting
  whatever was pooled physically, outside the app. No wallet, no amounts, no pot.
- **THE AIRGAP.** The player bundle has no channel to the conductor: no fetch, no
  socket, no shared store, no shared module graph. `src/player/airgap.test.ts` walks the
  player's real import graph and fails the build if that ever stops being true.

## How it works without a backend

A ticket ID is a **recipe**, not a database key. `K3P9Z-04` means "ticket 4 of the set
grown from seed K3P9Z" — any device rebuilds that exact grid from the string alone. So
the room code is the seed, room code + seat number is a ticket ID, and both QR
distribution and conductor-side claim verification work with nothing on a server.

## Stack

React 19 + TypeScript, Vite 8, Tailwind CSS v4, Vitest, `vite-plugin-pwa` (we own the
service worker). Capacitor Android wrapper is in the repo but parked this iteration.

## Getting started

```bash
npm install
npm run dev
```

```bash
npm test
npm run lint
npm run build
```

## Docs

- `PRD.md` — the spec, including the decisions and their trade-offs
- `ROADMAP.md` — phases, and what each one delivers
- `PROGRESS.md` — what is built right now
- `CLAUDE.md` / `AGENTS.md` — rules for agents working in this repo

## License

MIT.
