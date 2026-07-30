// Running the game: draw a number, call it out loud, rule on whatever gets shouted.
//
// The conductor taps to draw. There is no timer, no auto-call and no setting to turn
// one on (PRD.md §3, rule 3) — the pace of a tambola game is a person reading the room,
// and a countdown would take that away.

import { useMemo } from 'react'
import type { RoomConfig } from '../engine/room'
import { ClaimVerifier } from './ClaimVerifier'
import { NumberBoard } from './NumberBoard'
import { formatSeat } from './room'
import { useWakeLock } from './useWakeLock'
import {
  allConditionsWon,
  bogeyCount,
  latestCall,
  winnerOf,
  type Ruling,
  type StoredGame,
} from './game'

/** How many of the previous calls to keep on screen, latest first. */
const RECENT_COUNT = 6

interface CallerScreenProps {
  config: RoomConfig
  game: StoredGame
  /** The whole draw order for this game's seed. `game.history` is its front. */
  order: number[]
  onDraw: () => void
  onUndo: () => void
  onRule: (ruling: Omit<Ruling, 'atCall'>) => void
  onEnd: () => void
  onShowTickets: () => void
}

export function CallerScreen({
  config,
  game,
  order,
  onDraw,
  onUndo,
  onRule,
  onEnd,
  onShowTickets,
}: CallerScreenProps) {
  // A game runs for an hour with long gaps between taps; a sleeping screen means the
  // conductor unlocking their phone before every call.
  useWakeLock()

  const called = useMemo(() => new Set(game.history), [game.history])
  const latest = latestCall(game)
  const remaining = order.length - game.history.length
  // The calls before the latest one, most recent first: what "sorry, what was that?"
  // gets answered with.
  const recent = game.history.slice(-1 - RECENT_COUNT, -1).reverse()

  // Seats with a bogey against them, so the conductor can see who has been over-eager.
  const bogeySeats = [...new Set(game.rulings.filter((r) => !r.valid).map((r) => r.seat))]
    .sort((a, b) => a - b)

  return (
    <div className="stack">
      <section className="card stack-tight items-center text-center">
        {latest === null ? (
          // Before the first draw there is no number to show, and a placeholder set in
          // the callout size is a black bar across the screen.
          <p className="subtitle">Ready when the room is.</p>
        ) : (
          <>
            <span className="label">Just called</span>
            <p className="callout">{latest}</p>
          </>
        )}
        <p className="muted tabular-nums">
          {game.history.length} called · {remaining} left
        </p>
      </section>

      <button
        type="button"
        className="btn btn-block"
        onClick={onDraw}
        disabled={remaining === 0}
      >
        {remaining === 0 ? 'All 90 called' : 'Draw the next number'}
      </button>

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={onUndo}
        disabled={game.history.length === 0}
      >
        Undo the last draw
      </button>

      {recent.length > 0 && (
        <div className="stack-tight">
          <span className="label">Before that</span>
          <p className="font-mono tabular-nums">{recent.join(' · ')}</p>
        </div>
      )}

      <section className="stack-tight">
        <h2 className="subtitle">The board</h2>
        <NumberBoard called={called} latest={latest} />
      </section>

      <section className="stack-tight">
        <h2 className="subtitle">Playing for</h2>
        <ul className="card stack-tight">
          {config.conditions.map((condition) => {
            const winner = winnerOf(game.rulings, condition.id)
            return (
              <li
                key={condition.id}
                className="flex items-baseline justify-between gap-3"
              >
                <span>{condition.name}</span>
                <span className={`muted tabular-nums ${winner ? 'is-valid' : ''}`}>
                  {winner ? `Seat ${formatSeat(winner.seat)}` : 'Open'} ·{' '}
                  {condition.points} pts
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <ClaimVerifier
        config={config}
        history={game.history}
        rulings={game.rulings}
        onRule={onRule}
      />

      {bogeySeats.length > 0 && (
        <section className="stack-tight">
          <h2 className="subtitle">Bogeys</h2>
          <ul className="card stack-tight">
            {bogeySeats.map((seat) => (
              <li key={seat} className="flex items-baseline justify-between gap-3">
                <span className="tabular-nums">Seat {formatSeat(seat)}</span>
                <span className="muted is-bogey tabular-nums">
                  {bogeyCount(game.rulings, seat)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="stack">
        {allConditionsWon(config, game.rulings) && (
          <p className="muted">
            Every condition has been won. End the game to see the results.
          </p>
        )}
        <button type="button" className="btn btn-secondary btn-block" onClick={onEnd}>
          End the game
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={onShowTickets}
        >
          Back to the tickets
        </button>
      </section>
    </div>
  )
}
