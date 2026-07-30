// localStorage for PLAYER-side state, and nothing else.
//
// Three things live on a player's phone: the marks they tapped
// (`tambola:marks:<ticketId>`), the tickets this phone has opened
// (`tambola:player:tickets`) and the outcomes they recorded for themselves
// (`tambola:player:claims:<ticketId>`).
//
// Those prefixes are disjoint from the conductor's `tambola:room:*`, and that
// separation is asserted mechanically: src/player/airgap.test.ts fails the build
// if any module reachable from the conductor's entry point so much as names a
// player prefix. localStorage is same-origin, so "the conductor's screen could
// technically read this" is true — the test is what makes it never happen.
//
// Every read degrades to "nothing found" instead of throwing: private-mode
// Safari throws on localStorage access, and a player whose storage is blocked
// should still get a working ticket. They just lose reload-survival.

/** Prefix for everything the player's own screens keep about themselves. */
export const PLAYER_PREFIX = 'tambola:player:'

/** Read and parse a stored value. Null when absent, unreadable, or blocked. */
export function readJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Write a value. Silently does nothing when storage is full or blocked — the
 * in-memory state still works for this page load, and there is nothing useful to
 * say to a player mid-game about their browser's storage settings.
 */
export function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked.
  }
}

/** Forget a value. Silent if storage is unavailable — nothing was saved anyway. */
export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Nothing to do.
  }
}
