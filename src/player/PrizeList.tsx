// What this ticket has won, as the player recorded it themselves.
//
// Points are a share of 100 and only that: a percentage of whatever the room
// pooled physically, outside the app. No currency, no amount, no pot — see
// PRD.md §8. The conductor's results screen is the real ledger; this is the
// player's own copy, and the two can disagree if the player mis-taps. That is the
// accepted cost of having no channel between the devices (decision D2).
//
// A prize the conductor ruled a tie is split (PRD.md §7.5), so each won row carries
// "how many ways" — the one number about a tie the player actually heard. They did
// not hear the other winners' SEAT numbers, though, and the odd point on an uneven
// split goes to the lowest seat, so what this screen can honestly show is a range.
// Guessing a single figure would be wrong about half the time.

import type { Condition } from '../engine/patterns'
import {
  MAX_WINNERS,
  formatShare,
  pointsWon,
  type ClaimLog,
  type ClaimState,
} from './claims'

interface PrizeListProps {
  conditions: readonly Condition[]
  claims: ClaimLog
  /** Lets a mis-tap be taken back — the ruling happened out loud, not here. */
  onSetClaim: (conditionId: string, state: ClaimState | null, winners?: number) => void
}

/** "Just me" / "2 ways" / "3 ways"… — how the conductor would have said it. */
function winnersLabel(winners: number): string {
  return winners === 1 ? 'Just me' : `${winners} ways`
}

export function PrizeList({ conditions, claims, onSetClaim }: PrizeListProps) {
  const settled = conditions.filter((condition) => {
    const state = claims[condition.id]?.state
    return state === 'won' || state === 'bogey'
  })

  const total = pointsWon(conditions, claims)

  return (
    <section className="stack-tight">
      <h2 className="subtitle">This ticket</h2>

      {settled.length === 0 ? (
        <p className="muted">Nothing recorded yet.</p>
      ) : (
        <ul className="card stack-tight">
          {settled.map((condition) => {
            const record = claims[condition.id]
            const won = record.state === 'won'
            const splitId = `split-${condition.id}`
            return (
              <li key={condition.id} className="stack-tight">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={won ? 'is-valid' : 'is-bogey'}>
                    {condition.name}
                    {won ? '' : ' — bogey, not eligible'}
                  </span>
                  <span className="flex items-baseline gap-3">
                    {won && (
                      <span className="tabular-nums">
                        {formatShare(condition.points, record.winners)}
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn-inline"
                      onClick={() => onSetClaim(condition.id, null)}
                    >
                      Undo
                    </button>
                  </span>
                </div>

                {won && (
                  <div className="flex items-center gap-2">
                    <label className="muted" htmlFor={splitId}>
                      Shared
                    </label>
                    <select
                      id={splitId}
                      className="field w-32"
                      value={record.winners}
                      onChange={(event) =>
                        onSetClaim(condition.id, 'won', Number(event.target.value))
                      }
                    >
                      {Array.from({ length: MAX_WINNERS }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {winnersLabel(n)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </li>
            )
          })}

          <li className="flex items-baseline justify-between gap-3 border-t border-neutral-300 pt-2">
            <span className="subtitle">Total</span>
            <span className="subtitle tabular-nums">
              {total.low === total.high
                ? `${total.low} pts`
                : `${total.low}–${total.high} pts`}
            </span>
          </li>
        </ul>
      )}

      {/* Only worth explaining once a range is actually on screen. */}
      {total.low !== total.high && (
        <p className="muted">
          A shared prize doesn't always divide evenly, and this phone doesn't know
          which tickets took the odd point — the conductor's results screen has the
          exact figure.
        </p>
      )}
    </section>
  )
}
