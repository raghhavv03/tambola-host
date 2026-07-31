// The player's ticket: the grid they mark themselves, and everything they know
// about the room — which is only ever what the link or code they opened carried.
//
// Read the header comment in PlayerApp.tsx before changing anything here. In
// short: no auto-mark, no highlight, no hint that a number is on this ticket, no
// "you missed one". If they miss it, they miss it, and the app says nothing.

import type { Ticket } from '../engine/ticket'
import { TOTAL_POINTS, pointsTotal } from '../engine/patterns'
import type { RoomConfig } from '../engine/room'
import { HOME_ROUTE, JOIN_ROUTE, PLAYER_ROUTE, ticketFragment } from '../routes'
import { TicketCell } from './TicketCell'
import { ClaimPanel } from './ClaimPanel'
import { PrizeList } from './PrizeList'
import type { ClaimLog, ClaimState } from './claims'
import type { WalletTicket } from './wallet'

interface TicketScreenProps {
  ticketId: string
  ticket: Ticket
  /** Null when the link carried only a ticket ID and this phone has no room for it. */
  room: RoomConfig | null
  marks: Set<number>
  claims: ClaimLog
  /** Every ticket this phone has opened, so a player can hold more than one. */
  wallet: WalletTicket[]
  onToggleMark: (value: number) => void
  onSetClaim: (conditionId: string, state: ClaimState | null, winners?: number) => void
  onForget: () => void
  /** True while the "remove this ticket" confirmation is showing. */
  confirmingForget: boolean
  onConfirmForget: (confirming: boolean) => void
}

export function TicketScreen({
  ticketId,
  ticket,
  room,
  marks,
  claims,
  wallet,
  onToggleMark,
  onSetClaim,
  onForget,
  confirmingForget,
  onConfirmForget,
}: TicketScreenProps) {
  const conditions = room?.conditions ?? []

  // A room's split always totals 100, so anything short of it is sitting on a prize
  // this link couldn't name — a pattern the conductor drew, which a typed room code
  // has no way to carry (decision D1 in PRD.md). Derived rather than carried: the
  // shortfall IS the answer, and saying it beats a list that quietly adds up to 85.
  const unnamedPoints = TOTAL_POINTS - pointsTotal(conditions)

  // Sorted by ID, not by when they were opened: the switcher must not reshuffle
  // itself every time the player switches ticket.
  const switchable = [...wallet].sort((a, b) => a.id.localeCompare(b.id))

  return (
    <div className="screen stack">
      <header className="stack-tight">
        {/* Every screen in the app offers the way back to the front door. Leaving
            the ticket does not lose it: this phone remembers what it has opened. */}
        <a href={HOME_ROUTE} className="muted">
          ← Home
        </a>
        {room !== null && room.name.length > 0 && (
          <span className="label">{room.name}</span>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="title">Your ticket</h1>
          <span className="muted font-mono tracking-widest">{ticketId}</span>
        </div>
      </header>

      {/* Switching tickets is a plain link to a different fragment on this same
          page — the app re-reads the fragment and swaps ticket. No router: the
          player bundle stays one graph with no navigation machinery in it. */}
      {wallet.length > 1 && (
        <nav className="flex flex-wrap gap-2">
          {switchable.map((entry) => {
            const current = entry.id === ticketId
            return (
              <a
                key={entry.id}
                href={`${PLAYER_ROUTE}#${ticketFragment(entry.id, entry.room ?? undefined)}`}
                className={`btn font-mono text-sm ${current ? '' : 'btn-secondary'}`}
                aria-current={current ? 'page' : undefined}
              >
                {entry.id}
              </a>
            )
          })}
        </nav>
      )}

      {/* 9 columns, 3 rows. Cell width is fixed by the format (nine across a
          phone), so height is where the touch target gets big enough to hit. */}
      <div
        className="grid grid-cols-9 gap-1"
        style={{ gridTemplateRows: 'repeat(3, clamp(56px, 12vh, 96px))' }}
      >
        {ticket.flatMap((row, rowIndex) =>
          row.map((value, colIndex) => (
            <TicketCell
              key={`${rowIndex}-${colIndex}`}
              value={value}
              marked={value !== null && marks.has(value)}
              onToggle={() => value !== null && onToggleMark(value)}
            />
          )),
        )}
      </div>

      <p className="muted">
        Tap a number to mark it. Tap it again to clear it. When you complete a
        pattern, shout your claim out loud — the conductor checks it.
      </p>

      {conditions.length > 0 ? (
        <>
          <ClaimPanel
            conditions={conditions}
            claims={claims}
            onSetClaim={onSetClaim}
          />
          <PrizeList
            conditions={conditions}
            claims={claims}
            onSetClaim={onSetClaim}
          />
          {unnamedPoints > 0 && (
            <p className="muted">
              This room is also playing for {unnamedPoints} points' worth of prizes this
              link couldn't name. Ask the conductor what they are — you can still claim
              them, out loud, the same way.
            </p>
          )}
        </>
      ) : (
        <p className="muted">
          This link didn't carry the room's prize list, so this phone doesn't know
          what the room is playing for. Ask the conductor — the ticket works
          either way.
        </p>
      )}

      <section className="stack-tight">
        <a href={JOIN_ROUTE} className="btn btn-secondary btn-block">
          Add another ticket
        </a>

        {confirmingForget ? (
          <div className="card stack-tight">
            <p className="muted">
              Remove this ticket from this phone? Your marks and the prizes you
              recorded for it go too.
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn" onClick={onForget}>
                Remove it
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onConfirmForget(false)}
              >
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => onConfirmForget(true)}
          >
            Remove this ticket
          </button>
        )}
      </section>
    </div>
  )
}
