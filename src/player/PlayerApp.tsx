// The player's journey: joining a room (/join) and the ticket itself (/t).
//
// ===================== THE AIRGAP LIVES HERE =====================
// This bundle learns EVERYTHING it will ever know from the URL it was opened
// with, and then nothing else. No fetch, no socket, no poll, no import of the
// caller or the conductor's state. It does not know a game is in progress. It
// does not know a single number has come out.
//
// These files must never gain:
//   - the list of numbers the conductor has drawn, or anything derived from it
//   - an auto-marked cell, a highlighted cell, a pulsing cell
//   - "you missed one", "1 away from Full House", or any other nudge
//
// The player hears the conductor, finds the number on their own ticket, and
// taps it. The matching happens in their head. That is the entire reason this
// app exists. `src/player/airgap.test.ts` enforces the structural half of this
// mechanically: it walks this file's real import graph and fails the build if
// anything host-side, or any network API, is reachable from here.
// =================================================================

import { useEffect, useState } from 'react'
import { ticketFromId, parseTicketId } from '../engine/ticketId'
import { JOIN_ROUTE, ticketIdFromHash } from '../routes'
import { loadMarks, saveMarks } from './marks'
import { JoinForm } from './JoinForm'
import { TicketCell } from './TicketCell'

// Everything this screen knows: which ticket, and which cells the player has
// tapped. Kept as one object so the two can never drift apart — persisting
// ticket A's marks under ticket B's ID would silently corrupt both.
interface Session {
  ticketId: string | null
  marks: Set<number>
}

// Open a ticket: its ID, plus whatever marks this device already saved for it.
function openTicket(ticketId: string | null): Session {
  return {
    ticketId,
    marks: ticketId === null ? new Set() : loadMarks(ticketId),
  }
}

function BadLink({ reason }: { reason: string }) {
  return (
    <div className="screen stack">
      <h1 className="title">Can't open this ticket</h1>
      <p className="muted">{reason}</p>
      <a href={JOIN_ROUTE} className="btn btn-secondary btn-block">
        Enter a room code instead
      </a>
    </div>
  )
}

export function PlayerApp({ path }: { path: string }) {
  // On a first scan the marks start empty; after a reload they are the
  // player's own taps, restored from this device.
  const [session, setSession] = useState<Session>(() =>
    openTicket(ticketIdFromHash(window.location.hash)),
  )
  const { ticketId, marks } = session

  // Scanning a second QR while /t is already open changes only the URL
  // fragment, which does NOT reload the page. Without this listener the player
  // would keep staring at their previous ticket while the address bar claimed
  // otherwise.
  useEffect(() => {
    function handleHashChange() {
      setSession(openTicket(ticketIdFromHash(window.location.hash)))
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Persist on every change. Writing the whole small set is simpler than
  // tracking deltas, and there are at most 15 numbers in it.
  useEffect(() => {
    if (session.ticketId !== null) saveMarks(session.ticketId, session.marks)
  }, [session])

  if (path === JOIN_ROUTE) {
    return <JoinForm />
  }

  if (ticketId === null) {
    return <BadLink reason="This link is missing its ticket code." />
  }
  if (parseTicketId(ticketId) === null) {
    return <BadLink reason={`"${ticketId}" isn't a valid ticket code.`} />
  }

  // Rebuilt from the ID alone — the same grid the conductor handed out,
  // derived on this device, not fetched from anywhere.
  const ticket = ticketFromId(ticketId)
  if (ticket === null) {
    return <BadLink reason="That ticket code couldn't be rebuilt." />
  }

  function toggle(value: number) {
    setSession((previous) => {
      const next = new Set(previous.marks)
      if (next.has(value)) {
        next.delete(value)
      } else {
        next.add(value)
      }
      return { ...previous, marks: next }
    })
  }

  return (
    <div className="screen stack">
      <header className="flex items-baseline justify-between">
        <h1 className="title">Your ticket</h1>
        <span className="font-mono text-sm tracking-widest">{ticketId}</span>
      </header>

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
              onToggle={() => value !== null && toggle(value)}
            />
          )),
        )}
      </div>

      <p className="muted">
        Tap a number to mark it. Tap it again to clear it. When you complete a
        pattern, shout your claim out loud — the conductor checks it.
      </p>
    </div>
  )
}
