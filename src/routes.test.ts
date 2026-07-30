// The QR link format. Small, but both bundles depend on it: the conductor writes the
// fragment and the player reads it, with nothing in between to reconcile a mistake.

import { describe, it, expect } from 'vitest'
import { ticketUrl, ticketIdFromHash, roomFromHash, PLAYER_ROUTE } from './routes'

const ORIGIN = 'https://tambola.example'
// Base64url, i.e. exactly what encodeRoomConfig produces.
const ROOM = 'WzEsIkRpd2FsaSIsMTIzXQ'

describe('ticket links', () => {
  it('puts the ticket ID in the fragment, never the path', () => {
    const url = ticketUrl(ORIGIN, 'K3P9Z-04')
    expect(url).toBe(`${ORIGIN}${PLAYER_ROUTE}#K3P9Z-04`)
  })

  it('round-trips a ticket ID with a room description attached', () => {
    const url = ticketUrl(ORIGIN, 'K3P9Z-04', ROOM)
    const hash = url.slice(url.indexOf('#'))

    expect(ticketIdFromHash(hash)).toBe('K3P9Z-04')
    expect(roomFromHash(hash)).toBe(ROOM)
  })

  it('still reads a link that carries only a ticket ID', () => {
    expect(ticketIdFromHash('#K3P9Z-04')).toBe('K3P9Z-04')
    expect(roomFromHash('#K3P9Z-04')).toBeNull()
  })

  it('reports an empty or half-written fragment as missing', () => {
    expect(ticketIdFromHash('')).toBeNull()
    expect(ticketIdFromHash('#')).toBeNull()
    expect(roomFromHash('#K3P9Z-04~')).toBeNull()
  })
})
