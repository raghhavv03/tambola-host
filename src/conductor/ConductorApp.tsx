// The conductor's journey: set up a room, hand out tickets, call the numbers, rule on
// claims, read out the results.
//
// Everything the conductor does lives under this bundle: room setup, ticket
// distribution, the draw, and claim verification. The player's bundle can
// never import from here, which is what makes THE AIRGAP structural rather
// than a promise — src/player/airgap.test.ts fails the build if it does.
//
// There is no router here on purpose. The conductor's screens are steps in one flow,
// so they are plain state; the only real navigation in this app is BETWEEN bundles,
// and that is a full page load (see main.tsx).
//
// State lives here rather than in the screens because the screens share it: the same
// room description is what the distribution list prints and what the verifier rebuilds
// tickets from, and the same game record is what the caller advances and the results
// screen totals up.

import { useMemo, useState } from 'react'
import { drawOrder } from '../engine/caller'
import type { RoomConfig } from '../engine/room'
import { HOME_ROUTE } from '../routes'
import { CallerScreen } from './CallerScreen'
import { DistributionScreen } from './DistributionScreen'
import { ResultsScreen } from './ResultsScreen'
import { SetupScreen } from './SetupScreen'
import {
  clearRoom,
  loadRoom,
  saveRoom,
  withSeatName,
  withSeatsIssued,
  type StoredRoom,
} from './room'
import {
  canUndoDraw,
  clearGame,
  isFrozen,
  loadGame,
  newGame,
  saveGame,
  withoutRuling,
  type Ruling,
  type StoredGame,
} from './game'

export function ConductorApp() {
  // Read once, on mount: a conductor who locked their phone mid-game comes back to the
  // same room, the same list of seats handed out, and the same numbers already called.
  const [room, setRoom] = useState<StoredRoom | null>(loadRoom)
  const [game, setGame] = useState<StoredGame | null>(() =>
    room === null ? null : loadGame(room.config),
  )
  const [editing, setEditing] = useState(false)
  // Set while a game is running and the conductor has stepped back to the ticket list
  // (someone turned up late and needs a QR).
  const [viewingTickets, setViewingTickets] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  // The draw order is fixed by the game's seed, so it is derived, never stored: what
  // gets saved is only how far along it we are. See game.ts.
  const callSeed = game?.callSeed ?? null
  const order = useMemo(
    () => (callSeed === null ? [] : drawOrder(callSeed)),
    [callSeed],
  )

  // Keep state whether or not the write worked. Storage being blocked (private-mode
  // Safari, a full disk) shouldn't end the party — it just means nothing survives a
  // reload, and the conductor gets told so.
  function commitRoom(next: StoredRoom) {
    setRoom(next)
    setSaveFailed(!saveRoom(next))
  }

  function commitGame(next: StoredGame) {
    setGame(next)
    setSaveFailed(!saveGame(next))
  }

  function handleSave(config: RoomConfig) {
    // The rules freeze at the first number out (PRD.md §5.1). The edit button is
    // already hidden by then; this is the structural half of the same rule.
    if (isFrozen(game)) return

    // Seats are indexes into the ticket set, so shrinking the room can strand ticks
    // on seats that no longer exist. Drop those rather than carry a phantom count.
    const total = config.playerCount * config.ticketsPerPlayer
    const issuedSeats = (room?.issuedSeats ?? []).filter((seat) => seat < total)
    // Same reasoning for the names: a label on a seat the room no longer has is a ghost
    // that would come back the moment the conductor grew the room again.
    const seatNames = Object.fromEntries(
      Object.entries(room?.seatNames ?? {}).filter(([seat]) => Number(seat) < total),
    )
    commitRoom({ config, issuedSeats, seatNames })
    setEditing(false)
  }

  function handleRenameSeat(seat: number, name: string) {
    if (room === null) return
    commitRoom({ ...room, seatNames: withSeatName(room.seatNames, seat, name) })
  }

  function handleToggleIssued(seat: number) {
    if (room === null) return
    const issued = new Set(room.issuedSeats)
    if (issued.has(seat)) {
      issued.delete(seat)
    } else {
      issued.add(seat)
    }
    commitRoom({ ...room, issuedSeats: [...issued].sort((a, b) => a - b) })
  }

  function handleIssueSeats(seats: number[]) {
    if (room === null) return
    commitRoom({ ...room, issuedSeats: withSeatsIssued(room.issuedSeats, seats) })
  }

  function handleDiscard() {
    clearRoom()
    clearGame()
    setRoom(null)
    setGame(null)
    setEditing(false)
    setViewingTickets(false)
    setSaveFailed(false)
  }

  function handleStartCalling() {
    setViewingTickets(false)
    commitGame(newGame())
  }

  function handleDraw() {
    if (game === null || game.history.length >= order.length) return
    // Drawing is taking one more of the order this game's seed already decided.
    commitGame({ ...game, history: order.slice(0, game.history.length + 1) })
  }

  function handleUndo() {
    // A ruling made on the number about to go would end up pointing past the end of the
    // history, and the game would refuse to load next time (see canUndoDraw). The
    // button is already disabled by then; this is the structural half of the same rule.
    if (game === null || !canUndoDraw(game)) return
    commitGame({ ...game, history: game.history.slice(0, -1) })
  }

  function handleUndoRuling(index: number) {
    if (game === null) return
    commitGame(withoutRuling(game, index))
  }

  function handleRule(ruling: Omit<Ruling, 'atCall'>) {
    if (game === null) return
    commitGame({
      ...game,
      rulings: [...game.rulings, { ...ruling, atCall: game.history.length }],
    })
  }

  function handleEnd() {
    if (game === null) return
    commitGame({ ...game, ended: true })
  }

  function handleResumeGame() {
    if (game === null) return
    setViewingTickets(false)
    if (game.ended) commitGame({ ...game, ended: false })
  }

  function handlePlayAgain() {
    // Same tickets, same prize split, fresh draw and an empty ledger.
    commitGame(newGame())
  }

  const showSetup = room === null || editing

  // Picked with plain if/else rather than nested ternaries in the JSX: this is the
  // whole flow in one place, and TypeScript narrows `room` to non-null along the way.
  let body: React.ReactNode
  if (showSetup) {
    body = (
      <SetupScreen
        initial={room?.config ?? null}
        onSave={handleSave}
        onCancel={room === null ? undefined : () => setEditing(false)}
      />
    )
  } else if (game === null || viewingTickets) {
    body = (
      <DistributionScreen
        room={room}
        onToggleIssued={handleToggleIssued}
        onIssueSeats={handleIssueSeats}
        onRenameSeat={handleRenameSeat}
        onEdit={isFrozen(game) ? undefined : () => setEditing(true)}
        onDiscard={handleDiscard}
        onStart={handleStartCalling}
        onResume={game === null ? undefined : handleResumeGame}
      />
    )
  } else if (game.ended) {
    body = (
      <ResultsScreen
        config={room.config}
        seatNames={room.seatNames}
        game={game}
        onResume={handleResumeGame}
        onPlayAgain={handlePlayAgain}
      />
    )
  } else {
    body = (
      <CallerScreen
        config={room.config}
        seatNames={room.seatNames}
        game={game}
        order={order}
        onDraw={handleDraw}
        onUndo={handleUndo}
        onRule={handleRule}
        onUndoRuling={handleUndoRuling}
        onEnd={handleEnd}
        onShowTickets={() => setViewingTickets(true)}
      />
    )
  }

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

      {body}
    </div>
  )
}
