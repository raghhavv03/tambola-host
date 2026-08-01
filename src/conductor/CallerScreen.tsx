// Running the game: draw a number, call it out loud, rule on whatever gets shouted.
//
// The conductor taps to draw. There is no timer, no auto-call and no setting to turn
// one on (PRD.md §3, rule 3) — the pace of a tambola game is a person reading the room,
// and a countdown would take that away.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { RoomConfig } from '../engine/room'
import { ClaimVerifier } from './ClaimVerifier'
import { NumberBoard } from './NumberBoard'
import { formatSeat } from './room'
import { useWakeLock } from './useWakeLock'
import {
  allConditionsWon,
  bogeyCount,
  canUndoDraw,
  latestCall,
  winnersOf,
  type Ruling,
  type StoredGame,
} from './game'

/** How many of the previous calls to keep on screen, latest first. */
const RECENT_COUNT = 6

/** How many rulings the correction list goes back. Same reasoning as RECENT_COUNT. */
const RECENT_RULINGS = 6

interface CallerScreenProps {
  config: RoomConfig
  game: StoredGame
  /** The whole draw order for this game's seed. `game.history` is its front. */
  order: number[]
  onDraw: () => void
  onUndo: () => void
  onRule: (ruling: Omit<Ruling, 'atCall'>) => void
  /** Strike one ruling off the record. The index is into `game.rulings`. */
  onUndoRuling: (index: number) => void
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
  onUndoRuling,
  onEnd,
  onShowTickets,
}: CallerScreenProps) {
  // A game runs for an hour with long gaps between taps; a sleeping screen means the
  // conductor unlocking their phone before every call.
  useWakeLock()

  // Which ruling the conductor is being asked to confirm striking off, by its index in
  // game.rulings. null while nothing is being confirmed.
  const [confirmingUndo, setConfirmingUndo] = useState<number | null>(null)

  // The claim verifier sits below the board and the conditions panel, so checking a
  // claim scrolls the just-called number off the top of the screen — the one number
  // everyone in the room is also looking at, at the exact moment it is being argued
  // about. This watches the big number and puts a compact copy back when it goes.
  const calloutRef = useRef<HTMLElement | null>(null)
  const [calloutOnScreen, setCalloutOnScreen] = useState(true)

  useEffect(() => {
    const node = calloutRef.current
    if (node === null) return
    // Default threshold: any sliver of the card still showing counts as on screen, so
    // the bar appears only once the number has genuinely gone rather than half-way out.
    const observer = new IntersectionObserver(([entry]) => {
      setCalloutOnScreen(entry.isIntersecting)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const called = useMemo(() => new Set(game.history), [game.history])
  const latest = latestCall(game)
  const remaining = order.length - game.history.length
  // The calls before the latest one, most recent first: what "sorry, what was that?"
  // gets answered with.
  const recent = game.history.slice(-1 - RECENT_COUNT, -1).reverse()

  // A ruling made on the number now on the board pins that number in place — undoing
  // the draw would leave the ruling pointing past the end of the history, and the game
  // would refuse to load after the next reload (game.ts, canUndoDraw).
  const canUndo = canUndoDraw(game)

  // The last few rulings, most recent first, each carrying its real index so undoing
  // one strikes off the row the conductor actually tapped.
  const recentRulings = game.rulings
    .map((ruling, index) => ({ ruling, index }))
    .slice(-RECENT_RULINGS)
    .reverse()

  // Seats with a bogey against them, so the conductor can see who has been over-eager.
  const bogeySeats = [...new Set(game.rulings.filter((r) => !r.valid).map((r) => r.seat))]
    .sort((a, b) => a - b)

  return (
    <div className="stack">
      {latest !== null && !calloutOnScreen && (
        <div className="call-bar">
          <div className="call-bar-inner">
            <span className="label">Just called</span>
            <span className="title tabular-nums">{latest}</span>
            <span className="muted tabular-nums">{remaining} left</span>
          </div>
        </div>
      )}

      <section ref={calloutRef} className="card stack-tight items-center text-center">
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
        disabled={!canUndo}
      >
        Undo the last draw
      </button>

      {game.history.length > 0 && !canUndo && (
        <p className="muted">
          A claim was ruled on this number, so it can't be taken back yet. Undo that
          ruling below first.
        </p>
      )}

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
            // More than one winner is a tie the conductor ruled deliberately; the
            // points split between them (PRD.md §7.5).
            const winners = winnersOf(game.rulings, condition.id)
            return (
              <li
                key={condition.id}
                className="flex items-baseline justify-between gap-3"
              >
                <span>{condition.name}</span>
                <span
                  className={`muted tabular-nums ${winners.length > 0 ? 'is-valid' : ''}`}
                >
                  {winners.length === 0
                    ? 'Open'
                    : winners.map((seat) => `Seat ${formatSeat(seat)}`).join(' + ')}{' '}
                  · {condition.points} pts
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

      {/* Correcting the record. The conductor's ledger decides how the pot gets split
          (D2), and until now it was the only ledger in the app a mis-typed seat or a
          stray tap couldn't be taken back out of — the player's own prize list has had
          undo on every row since P4. This does not distinguish "I typed the wrong seat"
          from "I've changed my mind about a prize somebody won": the app has no way to
          tell those apart, so it doesn't pretend to, and the confirm step is there
          because the two look identical from here. */}
      {recentRulings.length > 0 && (
        <section className="stack-tight">
          <h2 className="subtitle">Recent rulings</h2>
          <ul className="card stack">
            {recentRulings.map(({ ruling, index }) => {
              const condition = config.conditions.find((c) => c.id === ruling.conditionId)
              return (
                <li key={index} className="stack-tight">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="tabular-nums">
                      Seat {formatSeat(ruling.seat)} ·{' '}
                      {condition?.name ?? ruling.conditionId}
                    </span>
                    <span
                      className={`muted tabular-nums ${ruling.valid ? 'is-valid' : 'is-bogey'}`}
                    >
                      {ruling.valid ? 'Won' : 'Bogey'} · call {ruling.atCall}
                    </span>
                  </div>

                  {confirmingUndo === index ? (
                    <div className="stack-tight">
                      <p className="muted">
                        Take this ruling off the record?{' '}
                        {ruling.valid
                          ? 'The condition opens up again for whoever claims it next.'
                          : 'The seat can claim this condition again.'}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            onUndoRuling(index)
                            setConfirmingUndo(null)
                          }}
                        >
                          Undo the ruling
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setConfirmingUndo(null)}
                        >
                          Keep it
                        </button>
                      </div>
                    </div>
                  ) : (
                    // The smaller of the two looks: recording a ruling is the common
                    // action, taking one back is the correction — same weighting as
                    // the distribution list's "Undo".
                    <button
                      type="button"
                      className="btn-inline self-start"
                      onClick={() => setConfirmingUndo(index)}
                    >
                      Undo
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

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
