// localStorage for CONDUCTOR-side state: the room setup, the game in progress,
// and the claims ledger. Generic on purpose — P0 only needs the plumbing; the
// shapes that go through it are defined where they are used (P2/P3).
//
// Keys are namespaced `tambola:room:*`, disjoint from the player's two prefixes,
// `tambola:marks:` (their taps) and `tambola:player:` (the tickets this phone
// holds and the outcomes they recorded) — see src/player/storage.ts. That
// separation is asserted by src/player/airgap.test.ts: no file reachable from the
// conductor's entry point may so much as name a player prefix, so those only ever
// flow player -> player, on the player's own device.
//
// Reads degrade silently to "nothing found" on any failure: private-mode Safari
// throws on localStorage access, and a conductor whose storage is blocked
// should still get a working (if unsaved) game.
//
// Writes are different: losing the draw history mid-party is real damage, so a
// failed write is reported back (boolean) and warned about, rather than
// swallowed. The caller decides how to surface it.

/** Every key this app writes on the conductor's side. One list, no strays. */
export const STORAGE_KEYS = {
  /** The room setup: name, conditions, points, ticket seed. */
  room: 'tambola:room:setup',
  /** The game in progress: the draw seed, how far along it is, and the rulings. */
  game: 'tambola:room:game',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/**
 * Read and parse a stored value. Returns null when absent OR unreadable —
 * callers treat both the same way, because a half-parsed game is worse than no
 * game. Validate the shape at the call site before trusting it.
 */
export function loadJSON<T>(key: StorageKey): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Write a value. Returns false if storage is full or blocked. */
export function saveJSON(key: StorageKey, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (err) {
    console.warn(`tambola: failed to save "${key}" to localStorage`, err)
    return false
  }
}

/** Forget a value. Silent if storage is unavailable — nothing was saved anyway. */
export function clearKey(key: StorageKey): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Nothing to do.
  }
}
