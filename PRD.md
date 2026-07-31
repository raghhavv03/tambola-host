# Tambola — Product Requirements (v2)

Status: **draft, awaiting approval.** Branch `major-changes`. This document supersedes
everything in the previous `CLAUDE.md`, `PROGRESS.md`, `RUNBOOK.md`,
`THEME_PACK_GUIDE.md` and `UI_INVENTORY.md`. Where it disagrees with them, this wins.

---

## 1. What we are building

A web app (later a mobile app) for running a **physical** tambola/housie game at a
party, office event or family gathering. One person conducts. Everyone else plays on
their own phone with a digital ticket, or on paper.

The app does four things:

1. Lets the **conductor** set up a game: room name, player count, tickets, winning
   conditions, and a points split.
2. Draws numbers 1–90 for the conductor to call out loud.
3. Gives **players** a ticket they mark themselves, on their own phone.
4. Settles claims: a player shouts, the conductor verifies on their device, the result
   (win or bogey) is recorded and turned into points.

The app never matches numbers for the player, never calls automatically, and never
touches money.

### What changed from v1 (and why)

| v1 | v2 |
| --- | --- |
| Theme packs were "the product" | **Removed entirely.** The Puranic/mythology pack was bad. Themes come back later, once we have packs worth shipping. |
| One journey (host screen) + a bare `/t` ticket | **Two full journeys:** conductor and player |
| Tickets distributed by QR only | **QR *and* a joinable room code** |
| Cast-to-TV display mode | **Removed** |
| Fixed six dividends | **Configurable winning conditions**, including custom patterns |
| No prize concept at all | **Points split (out of 100)** per winning condition |
| Themed visual system (Fraunces, stage tokens, glow) | **No design system.** Plain white, black buttons, consistent sizing. Design comes later. |

---

## 2. Users

**Conductor** — the person running the game. Holds the device that draws numbers and
rules on claims. One per game.

**Player** — has a ticket. Marks it themselves. Shouts claims out loud like they would
with a paper ticket.

These are the two journeys the website splits into from the front door. When social
login lands later, an account picks a role per game — the same person can conduct one
evening and play the next.

---

## 3. Core rules (non-negotiable)

These are product constraints, not preferences. If a feature needs one broken, stop and
raise it.

1. **The app never marks a player's ticket for them.** No auto-mark, no highlight, no
   "you missed one", no hint that a called number is on their ticket.
2. **The app never announces that a player has won.** The player notices, the player
   shouts, the conductor verifies. Winning conditions are checked *only* on demand.
3. **No auto-call by default.** The conductor taps to draw.
4. **No money in the app.** No wallet, no balance, no currency field, no pooling, no
   payment. Real-money gaming is illegal in India (PROG Act 2025) and we stay far away
   from the line — see §8 on points.
5. **No third-party IP.**
6. **The airgap holds.** A player's device has no channel to the conductor's device —
   no socket, no polling, no fetch, no shared storage. A player's screen learns only
   what was in the link or code they opened, and nothing after that.

> Why the airgap survives the redesign: the whole game is that the matching happens in a
> human head. A live channel from the caller to the ticket would make the app play the
> game for the player. A board of called numbers on the *conductor's* screen is correct
> and traditional; the same board cross-referenced against the player's own ticket is
> not.

---

## 4. Architecture decisions

**No backend in this iteration.** Everything is static, local, offline-capable.
Accounts, cloud sync and cross-device state are a later phase (see §11).

**Ticket identity is a recipe, not a database key.** A ticket ID like `K3P9ZQ-04` says
"ticket 4 of the set generated from seed K3P9ZQ". Any device can rebuild that exact
3×9 grid from the string alone. This is what makes both QR distribution and
conductor-side verification work with no server, and it carries over from v1 unchanged.

**Room code = the set seed.** The code a player types (`K3P9ZQ`) *is* the seed the
room's tickets came from. Code + seat number = ticket ID. Nothing is looked up.

**Consequence to accept:** a short typed code can carry a seed but cannot carry an
arbitrary custom rule set (names + patterns + points do not compress into six typeable
characters). See open decision **D1**.

---

## 5. Conductor journey

### 5.1 Setup (before the first number)

- **Room name** — free text, e.g. "Diwali 2026". Shown on the conductor screen and on
  the join screen.
- **Player count** — how many players. Drives how many tickets get generated.
- **Tickets per player** — 1 by default; a player can hold more.
- **Ticket generation** — auto-generate the whole set from a random seed (default), or
  enter a seed to reproduce a previous room exactly.
- **Distribution mode** — QR, room code, printable sheet, or any combination. Both
  digital modes are always available; the conductor picks what they show the room.
- **Winning conditions** — pick presets, add custom ones, assign points (§7, §8).
- Setup is reviewable and editable until the first number is drawn. After that, rules
  are frozen for the game.

### 5.2 Distribution

- **QR mode** — the conductor's screen shows one QR per ticket, in a pageable list.
  Each QR opens the player's ticket directly in a browser (or in the app when it
  exists). Nothing to type.
- **Code mode** — the conductor's screen shows the room code big. A player opens the
  site, enters the code and the seat number the conductor gave them, and their ticket
  is generated on their device. This is the path that will drive app installs later.
- Either way, the conductor's screen keeps an **issue list**: seats 01…N with a tap to
  mark "given out", so the same seat is never handed to two people. With no backend
  this hand-off is manual by design.
- **Print mode** — an A4 sheet, six tickets per page, ID printed on each.

### 5.3 Running the game

- Big current number, tap to draw, undo the last draw.
- Board of all 90 numbers, called ones marked.
- Recent calls strip.
- Count of numbers called / remaining.
- Conditions panel: each condition, its points, and whether it's still open or won (and
  by which seat).
- Pause / resume; the game survives a reload or a phone lock.

### 5.4 Verifying a claim

1. Player shouts. Conductor asks for the ticket ID (or seat number).
2. Conductor enters it and picks the condition being claimed.
3. The app rebuilds that ticket, checks it against the numbers actually called, and
   returns **VALID** or **BOGEY** with the specific numbers still missing.
4. Conductor confirms the ruling. On VALID the condition closes to that seat and its
   points are recorded. On BOGEY the seat is marked ineligible for that condition and
   the condition stays open.
5. Bogey count per seat is visible to the conductor.

### 5.5 End of game

- A results screen: every condition, who won it, points each seat earned, sorted.
- Game can be ended manually or when every condition is closed.

---

## 6. Player journey

- **Entry** — scan the QR, or open the site and enter the room code + seat number.
  Nothing to install, nothing to sign up for.
- **Ticket** — the 3×9 grid, large enough to tap accurately. Ticket ID and room name
  shown at the top; the player reads the ID out when claiming.
- **Marking** — tap a number to mark, tap again to unmark. Marks persist locally
  through a reload. No hint, no help, no validation while marking.
- **Claiming** — a "call a win" control listing the room's conditions. Tapping one
  records *the player's own intent* and tells them to shout it out loud. It transmits
  nothing.
- **Result** — after the conductor rules, the player taps the outcome on their own
  screen: won, or bogey. This is self-recorded — there is no channel, and that's the
  point.
- **Prizes** — a section listing what this ticket has won: e.g. "Top Line — 15 pts",
  and bogeys as "Full House — bogey, not eligible". Running points total for the
  ticket.
- Multiple tickets on one phone are switchable.

---

## 7. Winning conditions

### 7.1 Presets

Early Five, Top Line, Middle Line, Bottom Line, Four Corners, Full House. Conductor
toggles which ones this room plays.

### 7.2 Custom conditions

The conductor names a condition and taps the positions that satisfy it.

**Important design point:** the pattern editor works on the **3×5 logical grid** (three
rows × the five numbers in that row), *not* the 3×9 printed grid. Every ticket has
exactly five numbers per row, but the *columns* those numbers land in differ ticket to
ticket. A pattern defined on the printed grid would be unsatisfiable on some tickets and
trivial on others. On the logical grid, "four corners" is exactly positions (0,0),
(0,4), (2,0), (2,4) on every ticket in existence — which is why it is a real tambola
condition and, say, "column 3" is not.

A custom condition is: a name, a set of logical positions, and points. Presets are just
built-in patterns in the same shape, so verification has one code path.

### 7.3 Claim resolution

- One winner per condition. First valid claim closes it — **unless** two or more
  claims are ruled a genuine tie (§7.5).
- A bogey makes that seat ineligible for that condition, permanently, for that game.
- **Two winners of "the same" prize** (e.g. two Full Houses) are two separate
  conditions: same pattern, different names, their own points. This already works
  today via custom conditions (§7.2) — nothing new to build, just a UX gap (see
  `ROADMAP.md` P6). The app does not cross-check "has this seat already won an
  identical pattern elsewhere" — that stays a conductor judgment call, same as it
  would with a paper ticket.

### 7.4 Late claims (house rule, off by default)

Some rooms play it strict: if a ticket was already complete when an earlier number
was called, and the player only shouts after further numbers have since been drawn,
that claim is ruled a bogey — even though the ticket is still, mechanically, valid.
This is a conductor-chosen house rule, not universal law, so it's a per-room toggle
at setup, default **off**.

- Every ruling already records `atCall` — how many numbers had been called when it
  was ruled (`conductor/game.ts`). What's missing is the other half: the call count
  at which the pattern *first* became satisfied. That's one new pure function over
  the ticket, the call history and the pattern — no new storage.
- When the toggle is on and a claim checks out valid, the verifier also shows
  whether it was on time or late (completed at call N, checked at call M > N). The
  conductor still rules explicitly on what to do with that — the app surfaces the
  fact, never the verdict. Rule 2 (§3) holds either way.

### 7.5 Split wins (genuine ties)

If two or more players shout the same condition at effectively the same moment and
the conductor cannot honestly say who was first, that condition's points split
evenly between every claimant ruled valid in that moment, instead of the first one
taking all of it.

- Not a "how many winners does this condition have" setting configured up front —
  it's an explicit action the conductor takes when checking a claim: "tie this with
  seat 07" instead of "first valid claim wins." Only a condition that's still open
  can be tied into; the app will not reopen an already-closed one.
- Points split evenly; a remainder that doesn't divide cleanly (15 points, 2
  winners) needs a rule. Proposed: the extra point goes to the lower seat number,
  shown plainly on the results screen so nobody does the maths by hand.
- The results screen and per-seat scoreboard show a split explicitly — e.g. "Full
  House — tied with seat 07, 20 pts each."

---

## 8. Points, and why they are not money

The app cannot handle money and will not. But at Indian parties players commonly pool
cash physically and split it by who won what — and today that split is argued over.

So: the conductor assigns each winning condition a share of **100 points** at setup.
Points must total exactly 100 before the game can start; the setup screen shows the
running total and blocks starting until it balances. 100 is the scale because it reads
directly as a percentage — "Full House is 40 points" is instantly "40% of whatever you
put in the middle", with no mental arithmetic and no per-game scale to remember.

The app shows **points only**. No currency symbol, no amount, no pot size, no ledger, no
transfer, no wallet, no way to enter a rupee figure anywhere. What players do with the
percentage afterwards happens entirely outside the app, between humans, in cash, the
same way it happens with a paper ticket today. This keeps us clearly outside real-money
gaming: the app is a scorekeeper, not a stakeholder.

---

## 9. Non-goals for this iteration

- Themes and theme packs (explicitly returning later, with good packs)
- Cast-to-TV / room display mode (removed)
- Accounts, login, social auth
- Any backend, database, or cross-device sync
- Auto-call, voice calling, sound packs
- Animations, colour system, visual identity
- Multi-round tournaments, statistics across games

---

## 10. Design bar for this iteration

Deliberately plain:

- White background, black text, black buttons with white labels. Grey for borders and
  disabled states. Red for bogey, green for valid — semantic only.
- One system font stack. A fixed type scale. A fixed spacing scale. Consistent control
  heights and touch targets (44px minimum).
- Every element positioned as it will be in the designed version, so that the later
  design pass is colour, type and motion — not a rebuild.
- Mobile-first. The conductor is holding a phone; so is every player.

---

## 11. Later phases (recorded, not built)

- Design system, animation, theme packs.
- Native app (Capacitor scaffolding for Android already exists and is parked, untouched,
  on this branch).
- Accounts + social login, conductor/player roles on an account.
- A backend — the honest fix for the code-vs-QR asymmetry in **D1**, live prize sync,
  and rooms that outlive one device.

---

## 12. Open decisions

**D1 — how do custom rules reach a player who joined by code?**
A QR link carries the whole room config in its URL (unbounded length). A six-character
typed code carries only the seed. So a code-joiner's phone can build their ticket, but
cannot know the room's custom condition names or points.

- **Recommended (v1), built in P1:** the code carries the seed plus the *preset*
  conditions and their points, packed into a slightly longer code — 5 seed characters
  plus up to 10 of rules, e.g. `K3P9Z-1A2B3C4D5E`. Longer than first sketched, still
  typeable; see `PROGRESS.md` for the layout and why points aren't quantised. Custom
  conditions travel by QR only; if the conductor has defined any, the setup and
  distribution screens say plainly that code-joiners will not see them at all — an
  unnamed "Custom 1/2/3" row is noise, since a name is what makes a condition callable
  out loud. Everything
  else — ticket, marking, claiming, bogey — works identically on both paths.
- **Alternative:** code-joiners see no prize list at all until the conductor reads the
  rules out. Simpler to build, worse to use.
- **Real fix:** a backend, phase 2.

**D2 — does the conductor's device need the players' self-recorded results?**
No, in v1. The conductor's ledger is the source of truth; the player's prize screen is a
convenience copy they maintain themselves. Confirming this keeps the airgap trivially
intact.

**D3 — keep Capacitor/Android scaffolding on this branch?**
Recommended: yes, untouched and unbuilt. It costs nothing to leave and re-scaffolding
later is a chore.
