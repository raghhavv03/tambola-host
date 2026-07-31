// "Call a win" — and then recording what the conductor ruled.
//
// Tapping a condition here TRANSMITS NOTHING. It writes a note on this phone and
// tells the player to do the thing that actually matters: shout. The conductor
// hears it, types the ticket ID into their own device, and rules out loud. The
// player then taps what they heard.
//
// This panel must never gain a "check my ticket" button. It cannot know what has
// been drawn and it must not learn: the whole game is that the player matches the
// numbers in their own head and takes the risk of being wrong.

import type { Condition } from '../engine/patterns'
import type { ClaimLog, ClaimState } from './claims'

interface ClaimPanelProps {
  conditions: readonly Condition[]
  claims: ClaimLog
  onSetClaim: (conditionId: string, state: ClaimState | null) => void
}

export function ClaimPanel({ conditions, claims, onSetClaim }: ClaimPanelProps) {
  // Settled conditions (won or bogey) move to the prize list, so this section
  // only ever shows what is still in play for this ticket.
  const open = conditions.filter((condition) => {
    const state = claims[condition.id]?.state
    return state === undefined || state === 'claimed'
  })

  if (open.length === 0) return null

  return (
    <section className="stack-tight">
      <h2 className="subtitle">Call a win</h2>
      <p className="muted">
        Completed one? Tap it, then shout it out loud — the conductor checks your
        ticket on their own device. Nothing leaves this phone.
      </p>

      <ul className="stack-tight">
        {open.map((condition) => {
          const waiting = claims[condition.id]?.state === 'claimed'
          return (
            <li key={condition.id} className="card stack-tight">
              <div className="flex items-baseline justify-between gap-3">
                <span className="subtitle">{condition.name}</span>
                <span className="muted tabular-nums">{condition.points} pts</span>
              </div>

              {waiting ? (
                <>
                  <p className="muted">
                    Shout "{condition.name}" out loud, then tap what the conductor
                    ruled.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => onSetClaim(condition.id, 'won')}
                    >
                      I won it
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => onSetClaim(condition.id, 'bogey')}
                    >
                      Bogey
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => onSetClaim(condition.id, null)}
                    >
                      Not yet
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => onSetClaim(condition.id, 'claimed')}
                >
                  Call it
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
