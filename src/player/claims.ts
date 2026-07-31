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

/** One condition's entry in the player's own notebook. */
export interface ClaimRecord {
  state: ClaimState
  /**
   * How many tickets shared this prize, counting this one. 1 is the ordinary case:
   * won outright. More means the conductor ruled a tie and split the points, and the
   * player heard how many ways (PRD.md §7.5).
   */
  winners: number
}

/** Condition id -> what the player recorded. Absent means "not claimed yet". */
export type ClaimLog = Record<string, ClaimRecord>

const CLAIM_STATES: ClaimState[] = ['claimed', 'won', 'bogey']

/** Nobody at a party splits a prize more ways than this, and a select needs a top. */
export const MAX_WINNERS = 8

function storageKey(ticketId: string): string {
  return `${PLAYER_PREFIX}claims:${ticketId}`
}

/** Is this one of the three states we write? */
function isClaimState(value: unknown): value is ClaimState {
  return typeof value === 'string' && (CLAIM_STATES as string[]).includes(value)
}

/** Clamp a stored winner count into 1..MAX_WINNERS. Anything unreadable is 1. */
function readWinners(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return 1
  return Math.max(1, Math.min(MAX_WINNERS, value))
}

/**
 * Read back one ticket's claim log. Unknown values are dropped, not guessed at.
 *
 * A bare string is accepted as well as a record: that is the shape this file wrote
 * before prizes could be shared, and it means exactly `{ state, winners: 1 }`. A
 * player mid-game when the app updates keeps their notes rather than losing them.
 */
export function loadClaims(ticketId: string): ClaimLog {
  const parsed = readJSON<unknown>(storageKey(ticketId))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {}
  }

  const log: ClaimLog = {}
  for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
    if (isClaimState(entry)) {
      log[id] = { state: entry, winners: 1 }
      continue
    }
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue

    const record = entry as Record<string, unknown>
    if (!isClaimState(record.state)) continue
    log[id] = { state: record.state, winners: readWinners(record.winners) }
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
 *
 * `winners` defaults to whatever was already recorded, so changing "how many ways"
 * on a prize and changing its state are separate edits that don't clobber each other.
 */
export function withClaim(
  log: ClaimLog,
  conditionId: string,
  state: ClaimState | null,
  winners?: number,
): ClaimLog {
  const next = { ...log }
  if (state === null) {
    delete next[conditionId]
  } else {
    next[conditionId] = {
      state,
      winners: readWinners(winners ?? log[conditionId]?.winners ?? 1),
    }
  }
  return next
}

// --- What a shared prize is worth to this ticket ---------------------------------
//
// The conductor's device splits a tie evenly and hands the odd point to the lowest
// seat number (conductor/game.ts). This phone knows how many ways the prize went —
// the player heard that out loud — but not WHICH seats, so it cannot know whether
// this ticket is one of the ones that got the extra point. Rather than pick a number
// and be wrong half the time, it reports the range. The conductor's results screen is
// the ledger; this is the player's own copy (decision D2).

/** The lowest this ticket's share can be: the even split, rounded down. */
export function shareLow(points: number, winners: number): number {
  return Math.floor(points / Math.max(1, winners))
}

/** The highest it can be: one more, when the split leaves a remainder. */
export function shareHigh(points: number, winners: number): number {
  return Math.ceil(points / Math.max(1, winners))
}

/** "35 pts" when it divides (or wasn't shared), "17–18 pts" when it doesn't. */
export function formatShare(points: number, winners: number): string {
  const low = shareLow(points, winners)
  const high = shareHigh(points, winners)
  return low === high ? `${low} pts` : `${low}–${high} pts`
}

/**
 * Points this ticket has recorded as won — a share of 100, which is a percentage
 * of whatever the humans pooled physically, outside the app. There is no money
 * here and never will be (CLAUDE.md, PRD.md §8).
 *
 * Returned as a range for the same reason a single prize is: a ticket that shared
 * two prizes could be one point up on either of them.
 */
export function pointsWon(
  conditions: readonly Condition[],
  log: ClaimLog,
): { low: number; high: number } {
  const won = conditions.filter((condition) => log[condition.id]?.state === 'won')
  return {
    low: won.reduce((sum, c) => sum + shareLow(c.points, log[c.id].winners), 0),
    high: won.reduce((sum, c) => sum + shareHigh(c.points, log[c.id].winners), 0),
  }
}
