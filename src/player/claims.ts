// What the player recorded about their own claims, on their own phone.
//
// THE AIRGAP again, from the other side: the conductor's ruling never arrives
// here. There is no channel, by design (decision D2 in PRD.md). So this is the
// player's own note-keeping — they shout, the conductor rules out loud, and the
// player taps what happened. The conductor's ledger stays the source of truth;
// this is a convenience copy.
//
// Three states, one per condition:
//   claimed — "I've shouted for this, waiting on the ruling"
//   won     — the conductor said VALID; the points count toward this ticket
//   bogey   — the conductor said BOGEY; this ticket can never win that condition
//
// Nothing here verifies anything. This module cannot tell whether a claim is
// good, and must never learn how: the whole game is that the matching happens in
// the player's head and the ruling happens on the conductor's device.

import type { Condition } from '../engine/patterns'
import { readJSON, writeJSON, removeKey, PLAYER_PREFIX } from './storage'

/** Where one condition stands, as far as this phone knows. */
export type ClaimState = 'claimed' | 'won' | 'bogey'

/** Condition id -> what the player recorded. Absent means "not claimed yet". */
export type ClaimLog = Record<string, ClaimState>

const CLAIM_STATES: ClaimState[] = ['claimed', 'won', 'bogey']

function storageKey(ticketId: string): string {
  return `${PLAYER_PREFIX}claims:${ticketId}`
}

/** Read back one ticket's claim log. Unknown values are dropped, not guessed at. */
export function loadClaims(ticketId: string): ClaimLog {
  const parsed = readJSON<unknown>(storageKey(ticketId))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {}
  }

  const log: ClaimLog = {}
  for (const [id, state] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof state === 'string' && (CLAIM_STATES as string[]).includes(state)) {
      log[id] = state as ClaimState
    }
  }
  return log
}

/** Persist one ticket's claim log. */
export function saveClaims(ticketId: string, log: ClaimLog): void {
  writeJSON(storageKey(ticketId), log)
}

/** Forget one ticket's claims — the player removing that ticket from this phone. */
export function clearClaims(ticketId: string): void {
  removeKey(storageKey(ticketId))
}

/**
 * Set (or with `null`, clear) one condition's state, returning a new log. Pure, so
 * the screen can hand the result straight back into React state.
 */
export function withClaim(
  log: ClaimLog,
  conditionId: string,
  state: ClaimState | null,
): ClaimLog {
  const next = { ...log }
  if (state === null) {
    delete next[conditionId]
  } else {
    next[conditionId] = state
  }
  return next
}

/**
 * Points this ticket has recorded as won — a share of 100, which is a percentage
 * of whatever the humans pooled physically, outside the app. There is no money
 * here and never will be (CLAUDE.md, PRD.md §8).
 */
export function pointsWon(conditions: readonly Condition[], log: ClaimLog): number {
  return conditions
    .filter((condition) => log[condition.id] === 'won')
    .reduce((total, condition) => total + condition.points, 0)
}
