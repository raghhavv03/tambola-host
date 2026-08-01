import { describe, it, expect, beforeEach } from 'vitest'
import { installMockLocalStorage, type MockLocalStorage } from '../test/mockLocalStorage'
import { defaultConditions } from '../engine/patterns'
import type { RoomConfig } from '../engine/room'
import { STORAGE_KEYS } from './storage'
import {
  MAX_SEAT_NAME,
  clearRoom,
  formatSeat,
  loadRoom,
  parseStoredRoom,
  playerOfSeat,
  saveRoom,
  seatLabel,
  seatLabelInline,
  ticketCount,
  withSeatName,
  withSeatsIssued,
} from './room'

let store: MockLocalStorage

beforeEach(() => {
  store = installMockLocalStorage()
})

function config(overrides: Partial<RoomConfig> = {}): RoomConfig {
  return {
    name: 'Diwali 2026',
    seed: 1234567,
    playerCount: 12,
    ticketsPerPlayer: 1,
    conditions: defaultConditions(),
    strictClaimTiming: false,
    ...overrides,
  }
}

describe('seats', () => {
  it('counts one ticket per player per ticket-count', () => {
    expect(ticketCount(config())).toBe(12)
    expect(ticketCount(config({ ticketsPerPlayer: 3 }))).toBe(36)
  })

  it('maps a seat back to the player holding it', () => {
    // Two tickets each: seats 00 and 01 are player 1, 02 and 03 are player 2.
    expect(playerOfSeat(0, 2)).toBe(1)
    expect(playerOfSeat(1, 2)).toBe(1)
    expect(playerOfSeat(2, 2)).toBe(2)
    expect(playerOfSeat(5, 1)).toBe(6)
  })

  it('pads seat numbers the way the ticket ID does', () => {
    expect(formatSeat(0)).toBe('00')
    expect(formatSeat(7)).toBe('07')
    expect(formatSeat(42)).toBe('42')
  })

  it('marks a batch of seats given, sorted and de-duplicated', () => {
    // The conductor hands out a whole page at once. Seat 6 was already ticked off
    // individually, so the batch must not double it up.
    expect(withSeatsIssued([6, 1], [6, 7, 8])).toEqual([1, 6, 7, 8])
  })

  it('only ever adds seats to the issued list', () => {
    // No bulk undo: a seat somebody already walked away with must not come back on
    // screen because a page was marked again.
    expect(withSeatsIssued([0, 1, 2], [])).toEqual([0, 1, 2])
  })
})

describe('seat names', () => {
  it('reads a seat with no name as the plain seat number', () => {
    expect(seatLabel(4, {})).toBe('Seat 04')
    expect(seatLabelInline(4, {})).toBe('seat 04')
  })

  it('keeps the seat number alongside a name', () => {
    // Two people at a party can be called the same thing; the seat number is what is
    // printed on the ticket in their hand, so it never goes away.
    expect(seatLabel(4, { 4: 'Priya' })).toBe('Priya · seat 04')
    expect(seatLabelInline(4, { 4: 'Priya' })).toBe('Priya · seat 04')
  })

  it('sets and caps a name', () => {
    expect(withSeatName({}, 3, 'Priya')).toEqual({ 3: 'Priya' })
    expect(withSeatName({}, 3, 'x'.repeat(MAX_SEAT_NAME + 10))[3]).toHaveLength(
      MAX_SEAT_NAME,
    )
  })

  it('keeps the space in a half-typed two-word name', () => {
    // This runs on every keystroke of a controlled input. Trimming here would delete
    // the space in "Priya K" as it was typed, and the surname could never be started.
    expect(withSeatName({}, 3, 'Priya ')).toEqual({ 3: 'Priya ' })
  })

  it('removes the entry when the field is cleared', () => {
    // Storing "" would leave the seat labelled "· seat 03" everywhere else.
    expect(withSeatName({ 3: 'Priya' }, 3, '')).toEqual({})
    expect(withSeatName({ 3: 'Priya' }, 3, '   ')).toEqual({})
  })

  it('leaves the other seats alone', () => {
    expect(withSeatName({ 1: 'Amit', 3: 'Priya' }, 3, 'Ravi')).toEqual({
      1: 'Amit',
      3: 'Ravi',
    })
  })
})

describe('saved room', () => {
  it('round-trips a room and its issued seats', () => {
    expect(saveRoom({ config: config(), issuedSeats: [0, 3], seatNames: {} })).toBe(true)
    expect(loadRoom()).toEqual({ config: config(), issuedSeats: [0, 3], seatNames: {} })
  })

  it('round-trips seat names', () => {
    saveRoom({ config: config(), issuedSeats: [], seatNames: { 0: 'Priya', 4: 'Amit' } })
    expect(loadRoom()!.seatNames).toEqual({ 0: 'Priya', 4: 'Amit' })
  })

  it('trims a name on the way back in', () => {
    // withSeatName leaves a half-typed trailing space alone; this is where it goes.
    saveRoom({ config: config(), issuedSeats: [], seatNames: { 0: 'Priya ' } })
    expect(loadRoom()!.seatNames).toEqual({ 0: 'Priya' })
  })

  it('rebuilds patterns as real patterns, not bare JSON', () => {
    saveRoom({ config: config(), issuedSeats: [], seatNames: {} })
    const loaded = loadRoom()!
    const fullHouse = loaded.config.conditions.find((c) => c.id === 'fullHouse')!
    expect(fullHouse.pattern.cells).toHaveLength(15)
    expect(fullHouse.pattern.required).toBe(15)
  })

  it('returns null when nothing is saved', () => {
    expect(loadRoom()).toBeNull()
  })

  it('forgets the room on clear', () => {
    saveRoom({ config: config(), issuedSeats: [1], seatNames: {} })
    clearRoom()
    expect(loadRoom()).toBeNull()
  })

  it('drops issued seats that no longer exist', () => {
    // The conductor shrank the room from 12 players to 4 after ticking seat 9 off.
    store.setItem(
      STORAGE_KEYS.room,
      JSON.stringify({ version: 1, config: config({ playerCount: 4 }), issuedSeats: [1, 9] }),
    )
    expect(loadRoom()!.issuedSeats).toEqual([1])
  })

  it('de-duplicates and sorts issued seats', () => {
    expect(parseStoredRoom({ version: 1, config: config(), issuedSeats: [3, 1, 3] })!
      .issuedSeats).toEqual([1, 3])
  })

  it('rejects a record from a different version', () => {
    expect(parseStoredRoom({ version: 2, config: config(), issuedSeats: [] })).toBeNull()
  })

  it('rejects a malformed record rather than half-reading it', () => {
    expect(parseStoredRoom(null)).toBeNull()
    expect(parseStoredRoom({ version: 1 })).toBeNull()
    expect(parseStoredRoom({ version: 1, config: { ...config(), seed: 'K3P9Z' } })).toBeNull()
    expect(parseStoredRoom({ version: 1, config: { ...config(), playerCount: 0 } })).toBeNull()
    expect(
      parseStoredRoom({
        version: 1,
        config: { ...config(), conditions: [{ id: 'x', name: 'X', points: 100 }] },
      }),
    ).toBeNull()
  })

  it('treats a missing issued list as nothing given out', () => {
    expect(parseStoredRoom({ version: 1, config: config() })!.issuedSeats).toEqual([])
  })

  it('treats a room saved before names existed as a room with no names', () => {
    // Read tolerantly, the same way strictClaimTiming is: losing a set-up room over a
    // missing optional label would be a far worse trade than starting with no names.
    expect(parseStoredRoom({ version: 1, config: config() })!.seatNames).toEqual({})
  })

  it('drops names for seats the room no longer has', () => {
    // The conductor shrank the room from 12 players to 4 after naming seat 9.
    const room = parseStoredRoom({
      version: 1,
      config: config({ playerCount: 4 }),
      seatNames: { 1: 'Priya', 9: 'Amit' },
    })
    expect(room!.seatNames).toEqual({ 1: 'Priya' })
  })

  it('ignores name entries that are not names', () => {
    const room = parseStoredRoom({
      version: 1,
      config: config(),
      seatNames: { 0: 42, 1: '   ', 2: 'Priya', x: 'Amit', '-1': 'Ravi' },
    })
    expect(room!.seatNames).toEqual({ 2: 'Priya' })
  })

  it('reports a failed write instead of pretending it saved', () => {
    store.failNextWrite()
    expect(saveRoom({ config: config(), issuedSeats: [], seatNames: {} })).toBe(false)
  })
})
