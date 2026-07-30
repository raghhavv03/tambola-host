// Handing out the tickets: the room code to read out, a QR per seat, and a list of
// which seats have actually gone to a person.
//
// The issue list is manual by design. With no backend there is nothing that can know
// a player opened their link, so the conductor ticks seats off as they hand them over
// — which is exactly what stops the same seat going to two people.
//
// Two ways in, one ticket:
//   - QR: the link carries the ticket ID and the whole room description, so a scanned
//     ticket knows the room's name and its full prize list, custom conditions included.
//   - Room code: five characters plus the preset split. Short enough to shout across a
//     room, too short to carry custom rules — decision D1 in PRD.md.
// Neither is a channel. Both are read once, when the player's page opens.

import { useMemo, useState } from 'react'
import { generateIdentifiedSet } from '../engine/ticketId'
import { encodeRoomConfig, formatRoomCode, hasCustomConditions } from '../engine/room'
import { JOIN_ROUTE, ticketUrl } from '../routes'
import { QrCode } from './QrCode'
import { PrintSheet } from './PrintSheet'
import { formatSeat, playerOfSeat, ticketCount, type StoredRoom } from './room'

/** Seats per page. Six because that is also what fits on one printed sheet. */
const PAGE_SIZE = 6

interface DistributionScreenProps {
  room: StoredRoom
  onToggleIssued: (seat: number) => void
  onEdit: () => void
  onDiscard: () => void
}

export function DistributionScreen({
  room,
  onToggleIssued,
  onEdit,
  onDiscard,
}: DistributionScreenProps) {
  const { config, issuedSeats } = room
  const [page, setPage] = useState(0)
  const [printing, setPrinting] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const total = ticketCount(config)

  // Rebuilt from the seed every render-with-new-inputs, never stored: the set IS the
  // seed, so there is nothing to keep in sync.
  const tickets = useMemo(
    () => generateIdentifiedSet(total, config.seed),
    [total, config.seed],
  )

  // The room description that rides in every QR link. One per room, not one per
  // ticket — it is the same string for all of them.
  const encodedRoom = useMemo(() => encodeRoomConfig(config), [config])
  const origin = window.location.origin

  const issued = new Set(issuedSeats)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageTickets = tickets.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  if (printing) {
    // PrintSheet opens the print dialog as it mounts and calls back when it closes.
    return <PrintSheet tickets={tickets} onDone={() => setPrinting(false)} />
  }

  return (
    <div className="stack">
      <section className="card stack-tight">
        <span className="label">Room code</span>
        <p className="font-mono text-2xl font-bold tracking-widest break-all">
          {formatRoomCode(config)}
        </p>
        <p className="muted">
          Players open <span className="font-mono">{origin.replace(/^https?:\/\//, '')}
          {JOIN_ROUTE}</span>, type this code and the seat number you give them.
        </p>
        {hasCustomConditions(config) && (
          <p className="muted">
            This room has custom conditions, which a typed code can't carry. Players who
            join by code see the preset conditions only — give them a QR instead, or read
            the custom ones out.
          </p>
        )}
      </section>

      <section className="stack-tight">
        <h2 className="subtitle">Playing for</h2>
        <ul className="card stack-tight">
          {config.conditions.map((condition) => (
            <li key={condition.id} className="flex items-baseline justify-between gap-3">
              <span>{condition.name}</span>
              <span className="muted tabular-nums">{condition.points} pts</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="stack">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="subtitle">Tickets</h2>
          <span className="muted tabular-nums">
            {issued.size} of {total} given out
          </span>
        </div>

        <ul className="stack">
          {pageTickets.map((entry) => {
            const seat = entry.index
            const given = issued.has(seat)
            return (
              <li key={entry.id} className="card flex items-center gap-4">
                {/* Big enough to matter: this QR carries the whole room, so it has
                    a lot of modules and a small one is a QR a phone can't read. */}
                <QrCode
                  value={ticketUrl(origin, entry.id, encodedRoom)}
                  size={148}
                  className="shrink-0"
                />
                <div className="stack-tight min-w-0 flex-1">
                  <span className="title tabular-nums">Seat {formatSeat(seat)}</span>
                  <span className="muted font-mono break-all">{entry.id}</span>
                  <span className="muted">
                    Player {playerOfSeat(seat, config.ticketsPerPlayer)}
                  </span>
                  <button
                    type="button"
                    className={`btn ${given ? '' : 'btn-secondary'}`}
                    onClick={() => onToggleIssued(seat)}
                    aria-pressed={given}
                  >
                    {given ? 'Given out' : 'Mark given'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>

        {pageCount > 1 && (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
            >
              Previous
            </button>
            <span className="muted tabular-nums">
              Page {page + 1} of {pageCount}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              disabled={page >= pageCount - 1}
            >
              Next
            </button>
          </div>
        )}

        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => setPrinting(true)}
        >
          Print all {total} tickets
        </button>
      </section>

      <section className="stack">
        <button type="button" className="btn btn-block" disabled>
          Start calling numbers
        </button>
        <p className="muted">
          The caller and the claim verifier land in the next pass. Until then the room
          stays here, saved on this device.
        </p>

        <button type="button" className="btn btn-secondary btn-block" onClick={onEdit}>
          Edit the setup
        </button>

        {confirmingDiscard ? (
          <div className="card stack-tight">
            <p className="muted">
              Delete this room? The tickets people are already holding stop matching
              anything you set up next.
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn" onClick={onDiscard}>
                Delete the room
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmingDiscard(false)}
              >
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => setConfirmingDiscard(true)}
          >
            Start a different room
          </button>
        )}
      </section>
    </div>
  )
}
