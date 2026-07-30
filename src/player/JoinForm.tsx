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
import { parseTicketId } from '../engine/ticketId'
import { HOME_ROUTE, PLAYER_ROUTE } from '../routes'

export function JoinForm() {
  const [code, setCode] = useState('')
  const [seat, setSeat] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    // Seats are shown to players 1-based and padded to two digits ("04"), which
    // is exactly the second half of a ticket ID.
    const ticketId = `${code.trim()}-${seat.trim().padStart(2, '0')}`

    // parseTicketId is forgiving about case and spacing and strict about
    // everything else. If it says no, we say no — guessing would hand the
    // player a DIFFERENT ticket that looks perfectly valid.
    if (parseTicketId(ticketId) === null) {
      setError("That room code and seat number don't make a valid ticket.")
      return
    }

    // A full page load, not a client-side route change: /t is a separate bundle
    // on purpose (see main.tsx).
    window.location.assign(`${PLAYER_ROUTE}#${ticketId.toUpperCase()}`)
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
          placeholder="K3P9Z"
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
