// Holds a screen wake lock while the caller screen is mounted, so the conductor's
// phone doesn't sleep between draws. Conductor-only — it lives in this folder
// because the player's bundle must never grow a reason to import it.
//
// The browser auto-releases the lock whenever the tab is hidden, so we re-acquire
// on visibilitychange. Fully feature-detected: on a browser without the API
// (older iOS Safari) every call is a silent no-op.

import { useEffect } from 'react'

export function useWakeLock(): void {
  useEffect(() => {
    // navigator.wakeLock is not in every lib.dom; guard and narrow.
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> }
    }
    if (!nav.wakeLock) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        sentinel = await nav.wakeLock!.request('screen')
      } catch {
        // Denied (e.g. tab not visible/focused) — nothing to do; a later
        // visibilitychange will retry.
      }
    }

    const onVisibility = () => {
      // Re-acquire when the tab becomes visible again (the OS dropped the lock
      // while hidden). Guard against acquiring after unmount.
      if (!cancelled && document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => {})
      sentinel = null
    }
  }, [])
}
