// The end of the game: who won what, and what share of the 100 points each seat took.
//
// Points and nothing else. There is no amount, no currency and no pot anywhere in this
// app — what the room pooled physically, and how they split it by these percentages,
// happens between humans afterwards (PRD.md §8).

import type { RoomConfig } from '../engine/room'
import { formatSeat } from './room'
import { isOpen, seatScores, type StoredGame } from './game'

interface ResultsScreenProps {
  config: RoomConfig
  game: StoredGame
  /** Back to calling — the conductor ended it early, or by accident. */
  onResume: () => void
  /** Same tickets, fresh draw order and an empty ledger. */
  onPlayAgain: () => void
}

export function ResultsScreen({ config, game, onResume, onPlayAgain }: ResultsScreenProps) {
  const scores = seatScores(config, game.rulings)
  const unclaimed = config.conditions.filter((c) => isOpen(game.rulings, c.id))

  return (
    <div className="stack">
      <section className="stack-tight">
        <h2 className="subtitle">Results</h2>
        <p className="muted tabular-nums">
          {game.history.length} numbers called.
        </p>
      </section>

      {scores.length === 0 ? (
        <p className="muted">Nobody claimed anything this game.</p>
      ) : (
        <ul className="stack">
          {scores.map((score) => (
            <li key={score.seat} className="card stack-tight">
              <div className="flex items-baseline justify-between gap-3">
                <span className="subtitle tabular-nums">Seat {formatSeat(score.seat)}</span>
                <span className="title tabular-nums">{score.points} pts</span>
              </div>
              {/* One row each, with the share rather than the condition's face value:
                  a tied Full House is 18 points to this seat, not 35, and the results
                  screen is what gets read out at the end of the night. */}
              {score.won.length > 0 && (
                <ul className="stack-tight">
                  {score.won.map((win) => (
                    <li key={win.condition.id} className="muted tabular-nums">
                      {win.condition.name} — {win.points} pts
                      {win.sharedWith.length > 0 &&
                        ` · tied with ${win.sharedWith
                          .map((seat) => `seat ${formatSeat(seat)}`)
                          .join(', ')}`}
                    </li>
                  ))}
                </ul>
              )}
              {score.bogeys > 0 && (
                <p className="muted is-bogey">
                  {score.bogeys} bogey{score.bogeys === 1 ? '' : 's'}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {unclaimed.length > 0 && (
        <section className="stack-tight">
          <span className="label">Nobody won</span>
          <ul className="card stack-tight">
            {unclaimed.map((condition) => (
              <li key={condition.id} className="flex items-baseline justify-between gap-3">
                <span>{condition.name}</span>
                <span className="muted tabular-nums">{condition.points} pts</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="stack">
        <button type="button" className="btn btn-secondary btn-block" onClick={onResume}>
          Back to the game
        </button>
        <button type="button" className="btn btn-block" onClick={onPlayAgain}>
          Play again with these tickets
        </button>
        <p className="muted">
          Playing again keeps the same tickets and the same prize split, and starts a new
          draw. Nobody has to be handed anything twice.
        </p>
      </section>
    </div>
  )
}
