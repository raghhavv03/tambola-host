// Joining by room code — the alternative to scanning a QR.
//
// There is no lookup here, and no server to look anything up in. A ticket ID is
// the RECIPE for a ticket: "<room code>-<seat>" says "seat 4 of the set grown
// from seed K3P9Z", and any device can rebuild that exact grid from the string
// alone. So joining by code is pure string work — the two fields the player
// fills in ARE their ticket ID, and /t regenerates the ticket locally.
//
// The conductor reads the room code out to the room and gives each player their
// own seat number. Two people cannot be handed the same seat because the
// conductor's screen tracks which ones have gone out (P2).

import { useState } from 'react'
import { parseRoomCode } from '../engine/room'
import { formatTicketId } from '../engine/ticketId'
import { HOME_ROUTE, PLAYER_ROUTE } from '../routes'

export function JoinForm() {
  const [code, setCode] = useState('')
  const [seat, setSeat] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    // A room code is the seed the room's tickets grew from, followed by the
    // room's preset rules. Only the seed half matters here — the rules are for
    // the prize list. parseRoomCode is forgiving about case, spaces and hyphens
    // (a player squinting at a phone in a loud room) and strict about
    // everything else: if it says no, we say no, because guessing would hand
    // the player a DIFFERENT ticket that looks perfectly valid.
    const room = parseRoomCode(code)
    if (room === null) {
      setError("That room code isn't one this app can read. Check it and try again.")
      return
    }

    // The seat number is the ticket's index in the room's set, so seat + seed is
    // the whole ticket ID. Nothing is looked up anywhere.
    const seatNumber = Number(seat.trim())
    if (!Number.isInteger(seatNumber) || seatNumber < 0) {
      setError('Seat numbers look like 00, 01, 02 — check the one you were given.')
      return
    }

    // A full page load, not a client-side route change: /t is a separate bundle
    // on purpose (see main.tsx).
    window.location.assign(`${PLAYER_ROUTE}#${formatTicketId(room.seed, seatNumber)}`)
  }

  return (
    <form className="screen stack" onSubmit={handleSubmit}>
      <header className="stack-tight">
        <a href={HOME_ROUTE} className="muted">
          ← Home
        </a>
        <h1 className="title">Join a game</h1>
        <p className="muted">
          The conductor will read out a room code and give you a seat number.
        </p>
      </header>

      <div className="stack-tight">
        <label className="label" htmlFor="room-code">
          Room code
        </label>
        <input
          id="room-code"
          className="field font-mono tracking-widest uppercase"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="K3P9Z-7QW3"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          required
        />
      </div>

      <div className="stack-tight">
        <label className="label" htmlFor="seat-number">
          Seat number
        </label>
        <input
          id="seat-number"
          className="field font-mono tracking-widest"
          value={seat}
          onChange={(event) => setSeat(event.target.value)}
          placeholder="04"
          // Numeric keypad on a phone without making it a spinner on desktop.
          inputMode="numeric"
          pattern="[0-9]*"
          required
        />
      </div>

      {error !== null && <p className="muted is-bogey">{error}</p>}

      <button type="submit" className="btn btn-block">
        Open my ticket
      </button>

      <p className="muted">
        Scanned a QR code instead? It opens your ticket straight away — you
        don't need this form.
      </p>
    </form>
  )
}
