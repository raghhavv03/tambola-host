// Settling a claim: a player shouted, the conductor types their seat (or their ticket
// ID), picks the condition, and the app rules on it.
//
// This is the ONLY place a ticket is ever checked against the called numbers, and it
// runs only when the conductor asks. Nothing here watches tickets, nothing polls, and
// nothing announces a win — the player noticed and shouted first, which is the whole
// game (PRD.md §3, rules 1 and 2).
//
// It needs no channel to the player's phone: the room's seed plus the seat number
// regenerates the exact same grid the player is holding. That is what "a ticket ID is
// a recipe" buys.

import { useState } from 'react'
import type { Condition } from '../engine/patterns'
import type { RoomConfig } from '../engine/room'
import { completionCall, verifyClaim, type ClaimResult } from '../engine/ticket'
import { parseTicketId, ticketFromRef } from '../engine/ticketId'
import { formatSeat, ticketCount } from './room'
import { hasBogeyed, splitPoints, winnersOf, type Ruling } from './game'

interface ClaimVerifierProps {
  config: RoomConfig
  /** Every number called so far, oldest first. */
  history: number[]
  rulings: Ruling[]
  onRule: (ruling: Omit<Ruling, 'atCall'>) => void
}

/** A claim that has been checked but not yet ruled on. */
interface PendingClaim {
  seat: number
  condition: Condition
  result: ClaimResult
  /**
   * Seats that have already won this condition. Non-empty means recording this claim
   * makes it a tie and splits the points (PRD.md §7.5).
   */
  existingWinners: number[]
  /**
   * Which call the pattern first completed on, or null if it still hasn't. Only shown
   * when the room plays the strict-timing house rule (PRD.md §7.4).
   */
  completedAt: number | null
}

/**
 * Turn what the conductor typed into a seat number.
 *
 * Two forms are accepted because a claiming player will read out whichever one is in
 * front of them: the seat number the conductor handed them ("4", "04"), or the ticket
 * ID printed on the ticket itself ("K3P9Z-04"). They are the same number by design.
 */
function resolveSeat(raw: string, config: RoomConfig): { seat: number } | { error: string } {
  const cleaned = raw.trim().toUpperCase()
  const seats = ticketCount(config)

  if (cleaned.length === 0) return { error: 'Type a seat number or a ticket ID.' }

  let seat: number
  if (/^\d{1,3}$/.test(cleaned)) {
    seat = Number(cleaned)
  } else {
    const ref = parseTicketId(cleaned)
    if (ref === null) return { error: "That isn't a seat number or a ticket ID." }
    // A ticket from another room would verify perfectly against the wrong grid, so the
    // seed has to match this room's before we go anywhere near it.
    if (ref.setSeed !== config.seed) {
      return { error: 'That ticket was printed for a different room.' }
    }
    seat = ref.index
  }

  if (seat >= seats) {
    return { error: `This room only goes up to seat ${formatSeat(seats - 1)}.` }
  }
  return { seat }
}

/** "seat 03 — 18 pts · seat 07 — 17 pts", so nobody splits 35 by hand at a party. */
function describeSplit(condition: Condition, seats: number[]): string {
  return splitPoints(condition.points, seats)
    .map((share) => `seat ${formatSeat(share.seat)} — ${share.points} pts`)
    .join(' · ')
}

export function ClaimVerifier({ config, history, rulings, onRule }: ClaimVerifierProps) {
  const [seatText, setSeatText] = useState('')
  const [conditionId, setConditionId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingClaim | null>(null)

  // Won conditions stay in the list rather than disappearing, because a tie is ruled
  // AFTER the first winner is already recorded — two people shout at once, the
  // conductor checks one, then the other. Removing the row would make the second
  // check impossible (PRD.md §7.5).
  const choices = config.conditions.map((condition) => ({
    condition,
    winners: winnersOf(rulings, condition.id),
  }))
  const allWon = choices.every((choice) => choice.winners.length > 0)

  function reset() {
    setSeatText('')
    setConditionId('')
    setError(null)
    setPending(null)
  }

  function handleCheck(event: React.FormEvent) {
    event.preventDefault()
    setPending(null)

    const condition = config.conditions.find((c) => c.id === conditionId)
    if (condition === undefined) {
      setError('Pick the condition being claimed.')
      return
    }

    const resolved = resolveSeat(seatText, config)
    if ('error' in resolved) {
      setError(resolved.error)
      return
    }

    // The ticket is rebuilt here, from the room's seed and the seat number — the same
    // recipe the player's phone used. Nothing was transmitted between the two devices.
    const ticket = ticketFromRef({ setSeed: config.seed, index: resolved.seat })
    setError(null)
    setPending({
      seat: resolved.seat,
      condition,
      result: verifyClaim(ticket, history, condition.pattern),
      existingWinners: winnersOf(rulings, condition.id),
      // Cheap enough to always compute; only shown when the room plays the rule.
      completedAt: completionCall(ticket, history, condition.pattern),
    })
  }

  function handleRule(valid: boolean) {
    if (pending === null) return
    onRule({ conditionId: pending.condition.id, seat: pending.seat, valid })
    reset()
  }

  // A seat that already bogeyed this condition is out of it for the rest of the game
  // (PRD.md §7.3), even if the ticket now genuinely satisfies it.
  const ineligible =
    pending !== null && hasBogeyed(rulings, pending.condition.id, pending.seat)
  // Recording the same seat twice against one condition would be a double-tap, not a
  // tie — a seat cannot split a prize with itself.
  const alreadyWon = pending !== null && pending.existingWinners.includes(pending.seat)
  const wouldTie = pending !== null && pending.existingWinners.length > 0 && !alreadyWon
  // Late: the ticket was already complete some numbers before the conductor checked it.
  const late =
    pending !== null &&
    pending.completedAt !== null &&
    pending.completedAt < history.length

  return (
    <section className="stack">
      <h2 className="subtitle">Check a claim</h2>

      {allWon && (
        <p className="muted">
          Every condition has been won. You can still check one to rule a tie.
        </p>
      )}

      <form className="stack" onSubmit={handleCheck}>
        <div className="stack-tight">
          <label className="label" htmlFor="claim-seat">
            Seat number or ticket ID
          </label>
          <input
            id="claim-seat"
            className="field font-mono uppercase"
            value={seatText}
            onChange={(event) => setSeatText(event.target.value)}
            placeholder="04"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="stack-tight">
          <label className="label" htmlFor="claim-condition">
            Claiming
          </label>
          <select
            id="claim-condition"
            className="field"
            value={conditionId}
            onChange={(event) => setConditionId(event.target.value)}
          >
            <option value="">Pick a condition…</option>
            {choices.map(({ condition, winners }) => (
              <option key={condition.id} value={condition.id}>
                {condition.name} — {condition.points} pts
                {winners.length > 0 &&
                  ` · won by ${winners.map((s) => `seat ${formatSeat(s)}`).join(' + ')}`}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn btn-block">
          Check the ticket
        </button>
      </form>

      {error !== null && <p className="muted is-bogey">{error}</p>}

      {pending !== null && (
        <div className="card stack-tight">
          <span className="label">
            Seat {formatSeat(pending.seat)} · {pending.condition.name}
          </span>

          <p className={`title ${pending.result.valid ? 'is-valid' : 'is-bogey'}`}>
            {pending.result.valid ? 'VALID' : 'BOGEY'}
          </p>

          <p className="muted tabular-nums">
            {pending.result.marked.length} of {pending.condition.pattern.cells.length}{' '}
            called · {pending.result.required} needed
          </p>

          {!pending.result.valid && (
            <p className="muted">
              Still missing:{' '}
              {/* Ascending, because the conductor is checking these against the board
                  in front of them, not against the player's ticket. */}
              <span className="font-mono">
                {[...pending.result.missing].sort((a, b) => a - b).join(', ')}
              </span>
            </p>
          )}

          {/* The strict-timing house rule (PRD.md §7.4). A statement of fact, never a
              verdict — the conductor decides what a late claim is worth out loud. */}
          {config.strictClaimTiming && pending.completedAt !== null && (
            <p className={`muted tabular-nums ${late ? 'is-bogey' : 'is-valid'}`}>
              {late
                ? `Late: complete since call ${pending.completedAt}, ${history.length - pending.completedAt} number${history.length - pending.completedAt === 1 ? '' : 's'} ago.`
                : `On time: completed on call ${pending.completedAt}, the one just made.`}
            </p>
          )}

          {ineligible && (
            <p className="muted is-bogey">
              Seat {formatSeat(pending.seat)} already bogeyed {pending.condition.name} and
              can't win it in this game.
            </p>
          )}

          {alreadyWon && (
            <p className="muted">
              Seat {formatSeat(pending.seat)} has already won {pending.condition.name}.
            </p>
          )}

          {wouldTie && pending.result.valid && (
            <p className="muted">
              Recording this ties {pending.condition.name} and splits its{' '}
              {pending.condition.points} points:{' '}
              {describeSplit(pending.condition, [
                ...pending.existingWinners,
                pending.seat,
              ])}
              .
            </p>
          )}

          {/* The app never rules by itself: it says what it found, the conductor
              decides out loud, and only then is anything recorded. */}
          <div className="flex flex-wrap gap-2">
            {pending.result.valid && !ineligible && !alreadyWon && (
              <button type="button" className="btn" onClick={() => handleRule(true)}>
                {wouldTie ? 'Record as a tie' : 'Record the win'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleRule(false)}
            >
              Record a bogey
            </button>
            <button type="button" className="btn btn-secondary" onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
