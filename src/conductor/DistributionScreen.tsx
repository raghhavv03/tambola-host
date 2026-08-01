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
//   - Room code: five characters plus the prize split. Short enough to shout across a
//     room, too short to carry a name the conductor typed — decision D1 in PRD.md.
// Neither is a channel. Both are read once, when the player's page opens.
//
// A seat that has been handed over stops being offered: its QR goes, and it drops out
// of the print sheet. The only way it comes back is the conductor undoing the tick,
// which is the point — a QR still on screen next to "Given out" is the one thing that
// puts the same ticket in two people's hands.

import { useMemo, useState } from 'react'
import { generateIdentifiedSet } from '../engine/ticketId'
import { encodeRoomConfig, formatRoomCode, uncarriedConditions } from '../engine/room'
import { JOIN_ROUTE, ticketUrl } from '../routes'
import { QrCode } from './QrCode'
import { PrintSheet } from './PrintSheet'
import {
  MAX_SEAT_NAME,
  formatSeat,
  playerOfSeat,
  ticketCount,
  type StoredRoom,
} from './room'

/** Seats per page. Six because that is also what fits on one printed sheet. */
const PAGE_SIZE = 6

interface DistributionScreenProps {
  room: StoredRoom
  onToggleIssued: (seat: number) => void
  /** Mark several seats given in one go — the whole page on screen. Never un-marks. */
  onIssueSeats: (seats: number[]) => void
  /** Put a name on a seat, or clear it by passing an empty string. */
  onRenameSeat: (seat: number, name: string) => void
  /** Absent once the rules are frozen, i.e. from the first number out. */
  onEdit?: () => void
  onDiscard: () => void
  /** Begin the draw. Only offered when no game is running. */
  onStart: () => void
  /** Back to the game in progress. Absent when there isn't one. */
  onResume?: () => void
}

export function DistributionScreen({
  room,
  onToggleIssued,
  onIssueSeats,
  onRenameSeat,
  onEdit,
  onDiscard,
  onStart,
  onResume,
}: DistributionScreenProps) {
  const { config, issuedSeats, seatNames } = room
  const [page, setPage] = useState(0)
  const [printing, setPrinting] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [confirmingPage, setConfirmingPage] = useState(false)

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

  // The seats on this page nobody is holding yet — what the bulk action marks, and what
  // its label counts. A page whose seats have all gone offers nothing.
  const pageUngiven = pageTickets
    .filter((entry) => !issued.has(entry.index))
    .map((entry) => entry.index)

  // Paper is a way of handing a ticket out too, so a seat already given away is not on
  // the sheet. Reprinting the whole set halfway through is exactly how a seat ends up
  // in two pairs of hands.
  const unissued = tickets.filter((entry) => !issued.has(entry.index))

  // Conditions a typed room code cannot carry, named so the conductor knows precisely
  // what a code-joiner will be missing.
  const uncarried = uncarriedConditions(config.conditions)

  if (printing) {
    // PrintSheet opens the print dialog as it mounts and calls back when it closes.
    return <PrintSheet tickets={unissued} onDone={() => setPrinting(false)} />
  }

  return (
    <div className="stack">
      <section className="card stack-tight">
        <span className="label">Room code</span>
        <p className="title font-mono tracking-widest break-all">
          {formatRoomCode(config)}
        </p>
        <p className="muted">
          Players open <span className="font-mono">{origin.replace(/^https?:\/\//, '')}
          {JOIN_ROUTE}</span>, type this code and the seat number you give them.
        </p>
        {uncarried.length > 0 && (
          <p className="muted">
            A typed code can't carry {uncarried.map((c) => c.name).join(', ')} — the name
            is one you typed. Players who join by code see the rest of the list, and are
            told how many points are missing from it; give them a QR instead, or read
            those conditions out.
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
              <li key={entry.id} className="card stack-tight">
                <div className="flex items-center gap-4">
                  {given ? (
                    // The QR is gone, not greyed out: a scannable code next to the words
                    // "Given out" is exactly how one seat reaches two people. The box
                    // stays the same size so the list doesn't jump as seats go out.
                    <div className="flex size-[148px] shrink-0 items-center justify-center border border-neutral-300">
                      <span className="muted">Given out</span>
                    </div>
                  ) : (
                    /* Big enough to matter: this QR carries the whole room, so it has
                       a lot of modules and a small one is a QR a phone can't read. */
                    <QrCode
                      value={ticketUrl(origin, entry.id, encodedRoom)}
                      size={148}
                      className="shrink-0"
                    />
                  )}
                  <div className="stack-tight min-w-0 flex-1">
                    <span className="subtitle tabular-nums">Seat {formatSeat(seat)}</span>
                    <span className="muted font-mono break-all">{entry.id}</span>
                    <span className="muted">
                      Player {playerOfSeat(seat, config.ticketsPerPlayer)}
                    </span>
                    {given ? (
                      // Undoing is deliberately the smaller action of the two: marking a
                      // seat given is the common tap, taking it back is the correction.
                      <button
                        type="button"
                        className="btn-inline self-start"
                        onClick={() => onToggleIssued(seat)}
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => onToggleIssued(seat)}
                      >
                        Mark given
                      </button>
                    )}
                  </div>
                </div>

                {/* Optional, and conductor-side only: this name goes into neither the
                    room code nor the QR blob, so the player's phone never learns it.
                    It is here so that the caller screen, the verifier and above all the
                    results read out "Priya · seat 04" instead of a room full of numbers
                    when it is time to split what got pooled. */}
                <div className="stack-tight">
                  <label className="label" htmlFor={`seat-name-${seat}`}>
                    Who has this ticket (optional)
                  </label>
                  <input
                    id={`seat-name-${seat}`}
                    className="field"
                    value={seatNames[seat] ?? ''}
                    onChange={(event) => onRenameSeat(seat, event.target.value)}
                    placeholder="Name"
                    maxLength={MAX_SEAT_NAME}
                    autoComplete="off"
                  />
                </div>
              </li>
            )
          })}
        </ul>

        {/* Handing out one seat at a time is five pages of individual taps in a
            thirty-player room, with everybody stood there waiting. The confirm is the
            same weight as this screen's other bulk change ("Start a different room"),
            because the thing it guards is the same: a state change across several
            seats that only comes back one seat at a time. Offered from two seats up —
            below that the row's own "Mark given" is already the shorter path. */}
        {pageUngiven.length > 1 &&
          (confirmingPage ? (
            <div className="card stack-tight">
              <p className="muted">
                Mark all {pageUngiven.length} of these seats given out? Their QRs go off
                the screen and their tickets leave the print sheet. Undoing is one seat
                at a time.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    onIssueSeats(pageUngiven)
                    setConfirmingPage(false)
                  }}
                >
                  Mark them given
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmingPage(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => setConfirmingPage(true)}
            >
              Mark {pageUngiven.length} on this page given
            </button>
          ))}

        {pageCount > 1 && (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                // Turning the page abandons a confirm rather than carrying it over —
                // the seats it was asking about are no longer the ones on screen.
                setConfirmingPage(false)
                setPage((current) => Math.max(0, current - 1))
              }}
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
              onClick={() => {
                setConfirmingPage(false)
                setPage((current) => Math.min(pageCount - 1, current + 1))
              }}
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
          disabled={unissued.length === 0}
        >
          {issued.size === 0
            ? `Print all ${total} tickets`
            : `Print the ${unissued.length} not given out`}
        </button>
        {issued.size > 0 && unissued.length > 0 && (
          <p className="muted">
            Seats already given out are left off the sheet. Undo one above to print it
            again.
          </p>
        )}
      </section>

      <section className="stack">
        {onResume === undefined ? (
          <>
            <button type="button" className="btn btn-block" onClick={onStart}>
              Start calling numbers
            </button>
            <p className="muted">
              Hand every ticket out first: the rules freeze the moment the first number
              comes out.
            </p>
          </>
        ) : (
          <button type="button" className="btn btn-block" onClick={onResume}>
            Back to the game
          </button>
        )}

        {onEdit === undefined ? (
          <p className="muted">
            The game has started, so the setup is frozen. Points and conditions stay as
            they are until this game ends.
          </p>
        ) : (
          <button type="button" className="btn btn-secondary btn-block" onClick={onEdit}>
            Edit the setup
          </button>
        )}

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
