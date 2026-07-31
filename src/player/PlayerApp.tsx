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
//
// The prize list and the claim buttons do NOT breach this. The conditions come
// from the link the player was handed, before a single number came out, and a
// claim is a note on this phone plus an instruction to shout. Nothing flows the
// other way — the conductor's ruling reaches this screen through the player's
// ears and their thumb, which is decision D2 in PRD.md, taken on purpose.
// =================================================================

import { useEffect, useState } from 'react'
import { ticketFromId } from '../engine/ticketId'
import { decodeRoomConfig, type RoomConfig } from '../engine/room'
import {
  HOME_ROUTE,
  JOIN_ROUTE,
  ticketFragment,
  ticketIdFromHash,
  roomFromHash,
} from '../routes'
import { clearMarks, loadMarks, saveMarks } from './marks'
import {
  clearClaims,
  loadClaims,
  saveClaims,
  withClaim,
  type ClaimLog,
  type ClaimState,
} from './claims'
import {
  forgetTicket,
  loadWallet,
  rememberTicket,
  withTicket,
  type WalletTicket,
} from './wallet'
import { JoinForm } from './JoinForm'
import { TicketScreen } from './TicketScreen'

// Everything this screen knows: which ticket, which room it came from, which
// cells the player has tapped, and what they recorded about their own claims.
// Kept as one object so they can never drift apart — persisting ticket A's marks
// under ticket B's ID would silently corrupt both.
interface Session {
  ticketId: string | null
  /** The room description as it travelled, kept so switching can rebuild the URL. */
  encodedRoom: string | null
  room: RoomConfig | null
  marks: Set<number>
  claims: ClaimLog
}

const EMPTY_SESSION: Session = {
  ticketId: null,
  encodedRoom: null,
  room: null,
  marks: new Set(),
  claims: {},
}

/** Open whatever ticket the current URL fragment describes. */
function openTicket(hash: string): Session {
  const ticketId = ticketIdFromHash(hash)
  if (ticketId === null) return EMPTY_SESSION

  // A bare link ("/t#K3P9Z-04", a bookmark, a hand-typed URL) carries no room.
  // This phone may still remember the one that ticket arrived with, so the prize
  // list survives a bookmark — it is the player's own note, not a lookup.
  const encodedRoom =
    roomFromHash(hash) ??
    loadWallet().find((entry) => entry.id === ticketId)?.room ??
    null

  return {
    ticketId,
    encodedRoom,
    room: encodedRoom === null ? null : decodeRoomConfig(encodedRoom),
    marks: loadMarks(ticketId),
    claims: loadClaims(ticketId),
  }
}

function BadLink({ reason }: { reason: string }) {
  return (
    <div className="screen stack">
      <header className="stack-tight">
        <a href={HOME_ROUTE} className="muted">
          ← Home
        </a>
        <h1 className="title">Can't open this ticket</h1>
      </header>
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
    openTicket(window.location.hash),
  )
  // What this phone had remembered when the page opened. It only changes when the
  // player removes a ticket — opening one is folded in below instead, so the list
  // on screen is always current without a render-time write.
  const [storedWallet, setStoredWallet] = useState<WalletTicket[]>(() => loadWallet())
  const [confirmingForget, setConfirmingForget] = useState(false)
  const { ticketId, encodedRoom, room, marks, claims } = session

  // Rebuilt from the ID alone — the same grid the conductor handed out, derived
  // on this device, not fetched from anywhere. Null when the link's code is
  // broken, which is also what stops a mistyped URL being saved as a ticket.
  const ticket = ticketId === null ? null : ticketFromId(ticketId)
  const openId = ticket === null ? null : ticketId

  const wallet =
    openId === null ? storedWallet : withTicket(storedWallet, openId, encodedRoom)

  // Scanning a second QR while /t is already open changes only the URL
  // fragment, which does NOT reload the page. Without this listener the player
  // would keep staring at their previous ticket while the address bar claimed
  // otherwise. Switching tickets from the list below is the same mechanism.
  useEffect(() => {
    function handleHashChange() {
      setSession(openTicket(window.location.hash))
      // Re-read the list too: the ticket we are leaving was written to storage
      // after this component mounted, so the state from mount is now stale.
      setStoredWallet(loadWallet())
      setConfirmingForget(false)
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Remember every ticket this phone opens, so a player holding two of them can
  // switch between the two instead of losing the first to the second scan.
  useEffect(() => {
    if (openId !== null) rememberTicket(openId, encodedRoom)
  }, [openId, encodedRoom])

  // Persist on every change. Writing the whole small record is simpler than
  // tracking deltas, and there are at most 15 marks and six conditions in it.
  useEffect(() => {
    if (openId !== null) {
      saveMarks(openId, session.marks)
      saveClaims(openId, session.claims)
    }
  }, [openId, session])

  if (path === JOIN_ROUTE) {
    return <JoinForm />
  }

  if (ticketId === null) {
    return <BadLink reason="This link is missing its ticket code." />
  }
  if (ticket === null || openId === null) {
    return <BadLink reason={`"${ticketId}" isn't a valid ticket code.`} />
  }

  function toggleMark(value: number) {
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

  function setClaim(conditionId: string, state: ClaimState | null) {
    setSession((previous) => ({
      ...previous,
      claims: withClaim(previous.claims, conditionId, state),
    }))
  }

  // Removing a ticket takes its marks and its claims with it — they are only
  // meaningful together — and then moves to whatever this phone still holds.
  function handleForget() {
    if (ticketId === null) return
    clearMarks(ticketId)
    clearClaims(ticketId)
    const remaining = forgetTicket(ticketId)
    setStoredWallet(remaining)

    const next = remaining[0]
    if (next === undefined) {
      window.location.assign(JOIN_ROUTE)
      return
    }
    // Same page, new fragment: the hashchange listener above opens it.
    window.location.hash = ticketFragment(next.id, next.room ?? undefined)
  }

  return (
    <TicketScreen
      ticketId={ticketId}
      ticket={ticket}
      room={room}
      marks={marks}
      claims={claims}
      wallet={wallet}
      onToggleMark={toggleMark}
      onSetClaim={setClaim}
      onForget={handleForget}
      confirmingForget={confirmingForget}
      onConfirmForget={setConfirmingForget}
    />
  )
}
