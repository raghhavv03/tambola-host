// What this ticket has won, as the player recorded it themselves.
//
// Points are a share of 100 and only that: a percentage of whatever the room
// pooled physically, outside the app. No currency, no amount, no pot — see
// PRD.md §8. The conductor's results screen is the real ledger; this is the
// player's own copy, and the two can disagree if the player mis-taps. That is the
// accepted cost of having no channel between the devices (decision D2).

import type { Condition } from '../engine/patterns'
import { pointsWon, type ClaimLog, type ClaimState } from './claims'

interface PrizeListProps {
  conditions: readonly Condition[]
  claims: ClaimLog
  /** Lets a mis-tap be taken back — the ruling happened out loud, not here. */
  onSetClaim: (conditionId: string, state: ClaimState | null) => void
}

export function PrizeList({ conditions, claims, onSetClaim }: PrizeListProps) {
  const settled = conditions.filter((condition) => {
    const state = claims[condition.id]
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
            const won = claims[condition.id] === 'won'
            return (
              <li
                key={condition.id}
                className="flex items-baseline justify-between gap-3"
              >
                <span className={won ? 'is-valid' : 'is-bogey'}>
                  {condition.name}
                  {won ? '' : ' — bogey, not eligible'}
                </span>
                <span className="flex items-baseline gap-3">
                  {won && <span className="tabular-nums">{condition.points} pts</span>}
                  <button
                    type="button"
                    className="muted underline"
                    onClick={() => onSetClaim(condition.id, null)}
                  >
                    Undo
                  </button>
                </span>
              </li>
            )
          })}

          <li className="flex items-baseline justify-between gap-3 border-t border-neutral-200 pt-2">
            <span className="subtitle">Total</span>
            <span className="subtitle tabular-nums">{total} pts</span>
          </li>
        </ul>
      )}
    </section>
  )
}
