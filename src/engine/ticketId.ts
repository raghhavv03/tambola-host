// Ticket identity. Pure TypeScript, same rules as the rest of src/engine — no React,
// no app imports, no network, no storage.
//
// A ticket ID is not a lookup key into a database (there is no database). It is the
// RECIPE for the ticket, written down. Given only the string "K3P9Z-04" you can
// regenerate that exact 3x9 grid, byte for byte, forever. That is what makes both the
// QR link and the host's claim verifier possible without a backend:
//
//   - the QR on the host screen encodes the ID, and /t rebuilds the ticket from it
//   - the host types the ID into the verifier, and the host screen rebuilds the SAME
//     ticket independently — nothing was transmitted between them
//
// Format: "<setSeed in Crockford base32>-<index>", e.g. "K3P9Z-04".
//   setSeed = the seed the whole set of tickets was generated from
//   index   = which ticket in that set (0-based, zero-padded to 2 digits for looks)
//
// The seed is written in Crockford base32 (see base32.ts) precisely because a host
// types this off a phone screen or a printed sheet, out loud, in a loud room: mistype
// an O for a 0 in a base36 ID and you don't get an error, you get a DIFFERENT ticket
// that verifies perfectly and rules on the wrong claim.

import { encodeBase32, decodeBase32 } from './base32'
import { generateSet, type Ticket } from './ticket'

/** A ticket ID, taken apart. */
export interface TicketRef {
  setSeed: number
  index: number
}

/** Build the printed/scanned ID for ticket `index` of the set generated from `setSeed`. */
export function formatTicketId(setSeed: number, index: number): string {
  const seedPart = encodeBase32(setSeed)
  // Pad so IDs line up visually on a printed sheet. Values above 99 just get longer.
  const indexPart = String(index).padStart(2, '0')
  return `${seedPart}-${indexPart}`
}

/**
 * Parse an ID a human typed. Forgiving about case and stray whitespace (the host is
 * typing this while a room full of people waits), strict about everything else.
 *
 * Returns null if the string isn't a well-formed ID — callers show an error rather
 * than guessing, because guessing would verify the WRONG ticket.
 */
export function parseTicketId(raw: string): TicketRef | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '')
  // The hyphen is required: the seed alphabet contains digits, so without it we
  // couldn't tell where the seed ends and the index begins.
  const match = /^([0-9A-Z]+)-([0-9]{1,3})$/.exec(cleaned)
  if (!match) return null

  const setSeed = decodeBase32(match[1])
  const index = parseInt(match[2], 10)
  if (setSeed === null || !Number.isFinite(index)) return null

  return { setSeed, index }
}

/**
 * Rebuild the exact ticket an ID refers to.
 *
 * Why `index + 1` works: generateSet draws its per-ticket seeds sequentially from one
 * PRNG stream, so the first N tickets of a set are always the same tickets regardless
 * of how many were asked for. Generating just enough of the set to reach `index` gives
 * the identical grid the host printed, without needing to know the original set size.
 */
export function ticketFromRef(ref: TicketRef): Ticket {
  return generateSet(ref.index + 1, ref.setSeed)[ref.index]
}

/** Convenience: string straight to ticket. Null if the ID doesn't parse. */
export function ticketFromId(id: string): Ticket | null {
  const ref = parseTicketId(id)
  return ref === null ? null : ticketFromRef(ref)
}

/** One ticket plus the identity the host prints on it and encodes in its QR. */
export interface IdentifiedTicket {
  id: string
  index: number
  ticket: Ticket
}

/** Generate a set and label every ticket in it. */
export function generateIdentifiedSet(
  n: number,
  setSeed: number,
): IdentifiedTicket[] {
  return generateSet(n, setSeed).map((ticket, index) => ({
    id: formatTicketId(setSeed, index),
    index,
    ticket,
  }))
}
