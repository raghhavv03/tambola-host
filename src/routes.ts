// The app's four URLs, in one place.
//
// This module is imported by BOTH the conductor and the player bundles, which
// does not breach THE AIRGAP: it moves a URL format, not game state. Nothing
// here can tell a player's ticket what has been called. Keep it that way —
// this file must never grow anything but strings and pure string functions.
//
// A static host has no file behind any of these paths, so it must rewrite
// unknown paths to index.html or a scanned QR 404s. `vercel.json` does that;
// `vite dev` already does it locally.

/** Front door: pick a journey. */
export const HOME_ROUTE = '/'

/** The conductor's journey: set up and run a game. */
export const CONDUCT_ROUTE = '/conduct'

/** The player's journey, entry by typed room code + seat number. */
export const JOIN_ROUTE = '/join'

/** The player's ticket itself. Opened by QR, or by the join form. */
export const PLAYER_ROUTE = '/t'

/**
 * Separates the ticket ID from the room description in a /t fragment.
 *
 * '~' is URL-unreserved, so it survives every scanner and address bar untouched,
 * and it appears in neither half: a ticket ID is base32 plus a hyphen, and the
 * room description is base64url (A-Za-z0-9-_).
 */
const ROOM_SEPARATOR = '~'

/**
 * Absolute URL to encode into a QR, e.g. "http://192.168.1.5:5173/t#K3P9Z-04".
 *
 * The ticket ID lives in the FRAGMENT, after the '#', on purpose. Fragments are
 * never sent to a server, never land in access logs, never leak through the
 * Referer header. This app has no backend, but a static host still logs paths —
 * the ticket stays client-side no matter where it is deployed.
 *
 * `room` is the encoded room description (see engine/room.ts). It rides along so
 * a scanned ticket can show the room's name and its prize list — the things a
 * typed room code is too short to carry. It is still just a string in a link,
 * read once when the page opens: nothing here is a channel.
 */
export function ticketUrl(
  origin: string,
  ticketId: string,
  room?: string,
): string {
  const fragment = room ? `${ticketId}${ROOM_SEPARATOR}${room}` : ticketId
  return `${origin}${PLAYER_ROUTE}#${fragment}`
}

/**
 * Pull the ticket ID out of a location hash. Returns null when there isn't one,
 * so /t can say "this link is incomplete" instead of drawing a broken grid.
 */
export function ticketIdFromHash(hash: string): string | null {
  const id = hash.replace(/^#/, '').split(ROOM_SEPARATOR)[0].trim()
  return id.length > 0 ? id : null
}

/**
 * Pull the encoded room description out of a location hash, or null when the
 * link carried only a ticket ID (an older QR, or a hand-typed link). Decoding it
 * is engine/room.ts's job — this file only ever cuts strings.
 */
export function roomFromHash(hash: string): string | null {
  const parts = hash.replace(/^#/, '').split(ROOM_SEPARATOR)
  if (parts.length < 2) return null
  const room = parts.slice(1).join(ROOM_SEPARATOR).trim()
  return room.length > 0 ? room : null
}
