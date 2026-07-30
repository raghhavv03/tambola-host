import { describe, it, expect, beforeEach } from 'vitest'
import { installMockLocalStorage, type MockLocalStorage } from '../test/mockLocalStorage'
import { defaultConditions } from '../engine/patterns'
import type { RoomConfig } from '../engine/room'
import { STORAGE_KEYS } from './storage'
import {
  clearRoom,
  formatSeat,
  loadRoom,
  parseStoredRoom,
  playerOfSeat,
  saveRoom,
  ticketCount,
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
})

describe('saved room', () => {
  it('round-trips a room and its issued seats', () => {
    expect(saveRoom({ config: config(), issuedSeats: [0, 3] })).toBe(true)
    expect(loadRoom()).toEqual({ config: config(), issuedSeats: [0, 3] })
  })

  it('rebuilds patterns as real patterns, not bare JSON', () => {
    saveRoom({ config: config(), issuedSeats: [] })
    const loaded = loadRoom()!
    const fullHouse = loaded.config.conditions.find((c) => c.id === 'fullHouse')!
    expect(fullHouse.pattern.cells).toHaveLength(15)
    expect(fullHouse.pattern.required).toBe(15)
  })

  it('returns null when nothing is saved', () => {
    expect(loadRoom()).toBeNull()
  })

  it('forgets the room on clear', () => {
    saveRoom({ config: config(), issuedSeats: [1] })
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

  it('reports a failed write instead of pretending it saved', () => {
    store.failNextWrite()
    expect(saveRoom({ config: config(), issuedSeats: [] })).toBe(false)
  })
})
