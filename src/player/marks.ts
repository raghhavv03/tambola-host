// Where a player's own marks are kept between page loads.
//
// THE AIRGAP, precisely: the rule is that nothing may flow from the CALLER to the
// player's ticket. This module only ever moves the player's own taps to and from
// their own device, under a key derived from their own ticket ID. No other page in
// this app reads or writes this key prefix — `src/player/airgap.test.ts` fails the
// build if any module reachable from the host entry point so much as mentions it.
//
// Why store at all: a phone locks, a browser evicts a background tab, a thumb hits
// reload. Losing 40 minutes of marks mid-game is real damage, and the app is
// forbidden from helping the player reconstruct them (it must never reveal what was
// drawn). So the marks have to survive the reload themselves.

import { readJSON, writeJSON, removeKey } from './storage'

const KEY_PREFIX = 'tambola:marks:'

function storageKey(ticketId: string): string {
  return `${KEY_PREFIX}${ticketId}`
}

/**
 * Read back the marks for one ticket. Anything that isn't a list of numbers is
 * treated as no marks at all: storage survives deploys and devtools, so it is not
 * a trusted input.
 */
export function loadMarks(ticketId: string): Set<number> {
  const parsed = readJSON<unknown>(storageKey(ticketId))
  if (!Array.isArray(parsed)) return new Set()
  return new Set(parsed.filter((n): n is number => typeof n === 'number'))
}

/** Persist the marks for one ticket. */
export function saveMarks(ticketId: string, marks: Set<number>): void {
  writeJSON(storageKey(ticketId), [...marks])
}

/** Forget one ticket's marks — the player removing that ticket from this phone. */
export function clearMarks(ticketId: string): void {
  removeKey(storageKey(ticketId))
}
