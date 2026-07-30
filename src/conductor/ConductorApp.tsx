// The conductor's journey. P2 covers setup and distribution; the caller and the
// claim verifier arrive in P3 (see ROADMAP.md).
//
// Everything the conductor does lives under this bundle: room setup, ticket
// distribution, the draw, and claim verification. The player's bundle can
// never import from here, which is what makes THE AIRGAP structural rather
// than a promise — src/player/airgap.test.ts fails the build if it does.
//
// There is no router here on purpose. The conductor's screens are steps in one flow,
// so they are plain state; the only real navigation in this app is BETWEEN bundles,
// and that is a full page load (see main.tsx).

import { useState } from 'react'
import type { RoomConfig } from '../engine/room'
import { HOME_ROUTE } from '../routes'
import { DistributionScreen } from './DistributionScreen'
import { SetupScreen } from './SetupScreen'
import { clearRoom, loadRoom, saveRoom, type StoredRoom } from './room'

export function ConductorApp() {
  // Read once, on mount: a conductor who locked their phone mid-distribution comes
  // back to the same room and the same list of seats already handed out.
  const [room, setRoom] = useState<StoredRoom | null>(loadRoom)
  const [editing, setEditing] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  // Keep the room in state whether or not the write worked. Storage being blocked
  // (private-mode Safari, a full disk) shouldn't end the party — it just means the
  // room won't survive a reload, and the conductor gets told so.
  function commit(next: StoredRoom) {
    setRoom(next)
    setSaveFailed(!saveRoom(next))
  }

  function handleSave(config: RoomConfig) {
    // Seats are indexes into the ticket set, so shrinking the room can strand ticks
    // on seats that no longer exist. Drop those rather than carry a phantom count.
    const total = config.playerCount * config.ticketsPerPlayer
    const issuedSeats = (room?.issuedSeats ?? []).filter((seat) => seat < total)
    commit({ config, issuedSeats })
    setEditing(false)
  }

  function handleToggleIssued(seat: number) {
    if (room === null) return
    const issued = new Set(room.issuedSeats)
    if (issued.has(seat)) {
      issued.delete(seat)
    } else {
      issued.add(seat)
    }
    commit({ ...room, issuedSeats: [...issued].sort((a, b) => a - b) })
  }

  function handleDiscard() {
    clearRoom()
    setRoom(null)
    setEditing(false)
    setSaveFailed(false)
  }

  const showSetup = room === null || editing

  return (
    <div className="screen stack">
      <header className="stack-tight">
        <a href={HOME_ROUTE} className="muted">
          ← Home
        </a>
        <h1 className="title">
          {showSetup ? 'Set up the room' : (room?.config.name ?? 'Room')}
        </h1>
      </header>

      {saveFailed && (
        <p className="muted is-bogey">
          This device wouldn't save the room. Everything still works, but reloading the
          page will lose it.
        </p>
      )}

      {showSetup ? (
        <SetupScreen
          initial={room?.config ?? null}
          onSave={handleSave}
          onCancel={room === null ? undefined : () => setEditing(false)}
        />
      ) : (
        <DistributionScreen
          room={room}
          onToggleIssued={handleToggleIssued}
          onEdit={() => setEditing(true)}
          onDiscard={handleDiscard}
        />
      )}
    </div>
  )
}
