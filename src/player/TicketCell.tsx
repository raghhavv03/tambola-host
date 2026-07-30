// One tappable cell on a player's ticket.
//
// Marking is the whole point of this screen, so the interaction gets more care
// than a plain onClick would give it: a tap only counts if the finger barely
// moved. Otherwise every attempt to scroll the page would mark whatever was
// under the thumb — and a stray mark is real damage, because the app is
// forbidden from ever telling the player which numbers have actually come out.

import { useRef } from 'react'

/** How far a finger may drift during a tap before we treat it as a scroll. */
const MOVE_TOLERANCE_PX = 12

interface TicketCellProps {
  value: number | null
  marked: boolean
  onToggle: () => void
}

// Short buzz on a tap. Not supported on iOS Safari, hence the guard — it is a
// bonus, never the only feedback.
function buzz(ms: number) {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(ms)
}

export function TicketCell({ value, marked, onToggle }: TicketCellProps) {
  // Where the finger went down, so we can measure drift on the way up.
  const startPoint = useRef<{ x: number; y: number } | null>(null)

  // A blank square on the ticket. Not interactive, nothing to mark. Bordered
  // like the rest so the grid still reads as a grid.
  if (value === null) {
    return <div aria-hidden="true" className="rounded border border-neutral-200" />
  }

  function handlePointerDown(event: React.PointerEvent) {
    startPoint.current = { x: event.clientX, y: event.clientY }
  }

  function handlePointerUp(event: React.PointerEvent) {
    const start = startPoint.current
    startPoint.current = null
    if (start === null) return

    const drifted =
      Math.abs(event.clientX - start.x) > MOVE_TOLERANCE_PX ||
      Math.abs(event.clientY - start.y) > MOVE_TOLERANCE_PX
    if (drifted) return // that was a scroll, not a tap

    buzz(15)
    onToggle()
  }

  return (
    <button
      type="button"
      // touch-none: we handle pointer gestures ourselves, and it kills the
      // 300ms tap delay plus double-tap-to-zoom, both of which make marking
      // feel laggy.
      className={`flex touch-none items-center justify-center rounded border text-xl font-bold tabular-nums select-none ${
        marked
          ? 'border-black bg-black text-white'
          : 'border-neutral-400 bg-white text-black'
      }`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => (startPoint.current = null)}
      onPointerLeave={() => (startPoint.current = null)}
      onContextMenu={(event) => event.preventDefault()}
      aria-pressed={marked}
      aria-label={marked ? `${value}, marked` : String(value)}
    >
      {value}
    </button>
  )
}
