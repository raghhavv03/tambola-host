// Room setup: everything the conductor decides before the first number comes out.
//
// Nothing here is sent anywhere — the room is a set of numbers on this device. The
// seed is the interesting one: it is the recipe the whole ticket set grows from, and
// it IS the room code players type. Type a previous room's seed back in and you get
// that room's tickets again, exactly, with no server involved.

import { useState } from 'react'
import { decodeBase32, encodeBase32 } from '../engine/base32'
import { defaultConditions, pointsProblem, type Condition } from '../engine/patterns'
import { SEED_BITS, SEED_CHARS, randomSeed, type RoomConfig } from '../engine/room'
import { ConditionsEditor } from './ConditionsEditor'

/** Seeds are 25 bits, i.e. exactly five base32 characters. */
const SEED_LIMIT = 2 ** SEED_BITS

// Sanity limits, not product rules: they exist so a typo ("1000 players") doesn't
// hand the browser 6000 tickets to generate.
const MAX_PLAYERS = 200
const MAX_TICKETS_PER_PLAYER = 6

interface SetupScreenProps {
  /** The saved room being edited, or null when this is a new one. */
  initial: RoomConfig | null
  onSave: (config: RoomConfig) => void
  /** Back to distribution. Absent when there is no saved room to go back to. */
  onCancel?: () => void
}

/** A whole number typed into a text field, or null when it isn't one. */
function parseCount(text: string): number | null {
  const cleaned = text.trim()
  if (!/^\d+$/.test(cleaned)) return null
  return Number(cleaned)
}

export function SetupScreen({ initial, onSave, onCancel }: SetupScreenProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [playerCountText, setPlayerCountText] = useState(
    String(initial?.playerCount ?? 12),
  )
  const [ticketsText, setTicketsText] = useState(String(initial?.ticketsPerPlayer ?? 1))
  // Seeds are shown in base32 because that is the form the conductor reads out loud.
  const [seedText, setSeedText] = useState(() =>
    encodeBase32(initial?.seed ?? randomSeed(), SEED_CHARS),
  )
  const [conditions, setConditions] = useState<Condition[]>(
    initial?.conditions ?? defaultConditions(),
  )
  const [strictClaimTiming, setStrictClaimTiming] = useState(
    initial?.strictClaimTiming ?? false,
  )

  const playerCount = parseCount(playerCountText)
  const ticketsPerPlayer = parseCount(ticketsText)
  const seed = decodeBase32(seedText.trim().toUpperCase())

  // Every reason the room can't be saved yet, in the order the fields appear. Shown
  // as one list under the button rather than as per-field errors: the conductor is
  // filling this in with a room waiting, and a single "here's what's left" reads faster.
  const problems: string[] = []
  if (name.trim().length === 0) problems.push('Give the room a name.')
  if (playerCount === null || playerCount < 1 || playerCount > MAX_PLAYERS) {
    problems.push(`Player count must be a number between 1 and ${MAX_PLAYERS}.`)
  }
  if (
    ticketsPerPlayer === null ||
    ticketsPerPlayer < 1 ||
    ticketsPerPlayer > MAX_TICKETS_PER_PLAYER
  ) {
    problems.push(`Tickets per player must be between 1 and ${MAX_TICKETS_PER_PLAYER}.`)
  }
  if (seed === null || seed >= SEED_LIMIT) {
    problems.push(`The seed must be ${SEED_CHARS} characters, using 0-9 and A-Z.`)
  }
  // The points split blocks saving too, but ConditionsEditor already prints the
  // reason under the running total — repeating it here would say it twice.
  const pointsIssue = pointsProblem(conditions)
  const canSave = problems.length === 0 && pointsIssue === null

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave) return
    onSave({
      name: name.trim(),
      seed: seed!,
      playerCount: playerCount!,
      ticketsPerPlayer: ticketsPerPlayer!,
      conditions,
      strictClaimTiming,
    })
  }

  const totalTickets =
    playerCount !== null && ticketsPerPlayer !== null ? playerCount * ticketsPerPlayer : 0

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div className="stack-tight">
        <label className="label" htmlFor="room-name">
          Room name
        </label>
        <input
          id="room-name"
          className="field"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Diwali 2026"
          maxLength={40}
        />
      </div>

      <div className="flex gap-4">
        <div className="stack-tight flex-1">
          <label className="label" htmlFor="player-count">
            Players
          </label>
          <input
            id="player-count"
            className="field tabular-nums"
            value={playerCountText}
            onChange={(event) => setPlayerCountText(event.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
          />
        </div>
        <div className="stack-tight flex-1">
          <label className="label" htmlFor="tickets-per-player">
            Tickets each
          </label>
          <input
            id="tickets-per-player"
            className="field tabular-nums"
            value={ticketsText}
            onChange={(event) => setTicketsText(event.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
          />
        </div>
      </div>

      <p className="muted">
        {totalTickets > 0
          ? `${totalTickets} ticket${totalTickets === 1 ? '' : 's'} in this room, numbered from seat 00.`
          : 'Tickets are numbered from seat 00.'}
      </p>

      <div className="stack-tight">
        <label className="label" htmlFor="room-seed">
          Seed (this is the room code)
        </label>
        <div className="flex gap-2">
          <input
            id="room-seed"
            className="field font-mono tracking-widest uppercase"
            value={seedText}
            onChange={(event) => setSeedText(event.target.value)}
            maxLength={SEED_CHARS}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="btn btn-secondary shrink-0"
            onClick={() => setSeedText(encodeBase32(randomSeed(), SEED_CHARS))}
          >
            New
          </button>
        </div>
        <p className="muted">
          Every ticket in the room is grown from this. Keep the one we picked, or type an
          old room's seed to deal the exact same tickets again.
        </p>
      </div>

      <ConditionsEditor conditions={conditions} onChange={setConditions} />

      <section className="stack-tight">
        <h2 className="subtitle">House rules</h2>
        <div className="card stack-tight">
          <div className="flex min-h-11 items-center gap-3">
            <input
              id="strict-claim-timing"
              type="checkbox"
              className="size-5 shrink-0 accent-black"
              checked={strictClaimTiming}
              onChange={(event) => setStrictClaimTiming(event.target.checked)}
            />
            <label htmlFor="strict-claim-timing" className="flex-1">
              Late claims are bogeys
            </label>
          </div>
          <p className="muted">
            When a claim checks out, the verifier also says which call the ticket
            actually completed on — so a player who only noticed several numbers later
            can be ruled a bogey. You still make the call; the app only tells you when
            it happened. Announce this one to the room before you start.
          </p>
        </div>
      </section>

      {problems.length > 0 && (
        <ul className="stack-tight">
          {problems.map((problem) => (
            <li key={problem} className="muted is-bogey">
              {problem}
            </li>
          ))}
        </ul>
      )}

      <button type="submit" className="btn btn-block" disabled={!canSave}>
        {initial === null ? 'Create the room' : 'Save changes'}
      </button>

      {onCancel !== undefined && (
        <button type="button" className="btn btn-secondary btn-block" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  )
}
