// The tickets this phone has opened.
//
// A player can hold more than one ticket (the conductor's setup has a "tickets per
// player" field), and each one arrives as its own QR scan or its own trip through
// the join form. Without a list, opening the second ticket would lose the first:
// the URL fragment only ever describes ONE ticket.
//
// This is a list of strings the player was already handed, kept on their own
// device. It is not a lookup, not a sync, not a channel — nothing here learns
// anything the player didn't already open.

import { readJSON, writeJSON, PLAYER_PREFIX } from './storage'

const KEY = `${PLAYER_PREFIX}tickets`

/**
 * How many tickets a phone remembers. Generous for one evening (six is a full
 * printed sheet), small enough that last month's party doesn't clutter the
 * switcher forever — the oldest simply falls off the end.
 */
const MAX_TICKETS = 12

/** One remembered ticket. */
export interface WalletTicket {
  /** The ticket ID, e.g. "K3P9Z-04". Rebuilds the grid on its own. */
  id: string
  /**
   * The encoded room description this ticket arrived with (see engine/room.ts),
   * or null for a bare link that carried only a ticket ID. Kept as the raw string
   * rather than a decoded object so switching tickets can rebuild the same URL.
   */
  room: string | null
}

/** Every ticket this phone knows, most recently opened first. */
export function loadWallet(): WalletTicket[] {
  const parsed = readJSON<unknown>(KEY)
  if (!Array.isArray(parsed)) return []

  const tickets: WalletTicket[] = []
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue
    const { id, room } = entry as Partial<WalletTicket>
    if (typeof id !== 'string' || id.length === 0) continue
    tickets.push({ id, room: typeof room === 'string' ? room : null })
  }
  return tickets.slice(0, MAX_TICKETS)
}

/**
 * A list with `id` added (or moved) to the front. Pure, so the ticket screen can
 * show a freshly opened ticket in the switcher without waiting for the write.
 *
 * `room` is only overwritten when the new link actually carries one: a player who
 * scans a QR (full room) and later opens the same ticket from a plain bookmark
 * (no room) should keep their prize list rather than lose it.
 */
export function withTicket(
  tickets: readonly WalletTicket[],
  id: string,
  room: string | null,
): WalletTicket[] {
  const previous = tickets.find((ticket) => ticket.id === id)
  const updated: WalletTicket = { id, room: room ?? previous?.room ?? null }

  return [updated, ...tickets.filter((ticket) => ticket.id !== id)].slice(
    0,
    MAX_TICKETS,
  )
}

/** Record a ticket this phone just opened and return the updated list. */
export function rememberTicket(id: string, room: string | null): WalletTicket[] {
  const tickets = withTicket(loadWallet(), id, room)
  writeJSON(KEY, tickets)
  return tickets
}

/** Drop a ticket from this phone and return what's left. */
export function forgetTicket(id: string): WalletTicket[] {
  const tickets = loadWallet().filter((ticket) => ticket.id !== id)
  writeJSON(KEY, tickets)
  return tickets
}
