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
 * Absolute URL to encode into a QR, e.g. "http://192.168.1.5:5173/t#K3P9Z-04".
 *
 * The ticket ID lives in the FRAGMENT, after the '#', on purpose. Fragments are
 * never sent to a server, never land in access logs, never leak through the
 * Referer header. This app has no backend, but a static host still logs paths —
 * the ticket stays client-side no matter where it is deployed.
 */
export function ticketUrl(origin: string, ticketId: string): string {
  return `${origin}${PLAYER_ROUTE}#${ticketId}`
}

/**
 * Pull the ticket ID out of a location hash. Returns null when there isn't one,
 * so /t can say "this link is incomplete" instead of drawing a broken grid.
 */
export function ticketIdFromHash(hash: string): string | null {
  const id = hash.replace(/^#/, '').trim()
  return id.length > 0 ? id : null
}
