import { describe, it, expect } from 'vitest'
import {
  formatRoomCode,
  parseRoomCode,
  encodeRoomConfig,
  decodeRoomConfig,
  hasCustomConditions,
  randomSeed,
  SEED_CHARS,
  type RoomConfig,
} from './room'
import { defaultConditions, makePattern, cellAt, type Condition } from './patterns'
import { formatTicketId, parseTicketId } from './ticketId'

const CUSTOM: Condition = {
  id: 'custom-1',
  name: 'Diagonal-ish',
  pattern: makePattern([cellAt(0, 0), cellAt(1, 2), cellAt(2, 4)]),
  points: 20,
}

function room(overrides: Partial<RoomConfig> = {}): RoomConfig {
  return {
    name: 'Diwali 2026',
    seed: 1234567,
    playerCount: 12,
    ticketsPerPlayer: 1,
    conditions: defaultConditions(),
    ...overrides,
  }
}

describe('randomSeed', () => {
  it('always fits the fixed-width seed field', () => {
    for (let i = 0; i < 500; i++) {
      const seed = randomSeed()
      expect(Number.isInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(formatRoomCode(room({ seed })).split('-')[0].length).toBe(SEED_CHARS)
    }
  })

  it('prints the same seed characters on a ticket ID as in the room code', () => {
    // formatTicketId does not pad the seed, so a small seed would read "34Z-00" on a
    // ticket and "0034Z" in the code. randomSeed only draws full-width seeds.
    for (let i = 0; i < 500; i++) {
      const seed = randomSeed()
      expect(formatTicketId(seed, 0).split('-')[0]).toBe(
        formatRoomCode(room({ seed })).split('-')[0],
      )
    }
  })
})

describe('room code', () => {
  it('round-trips the seed and the full preset split', () => {
    const config = room()
    const parsed = parseRoomCode(formatRoomCode(config))

    expect(parsed).not.toBeNull()
    expect(parsed!.seed).toBe(config.seed)
    expect(parsed!.conditions).toEqual(config.conditions)
  })

  it('round-trips a subset of the presets', () => {
    const conditions = defaultConditions()
      .filter((c) => c.id === 'topLine' || c.id === 'fullHouse')
      .map((c) => ({ ...c, points: c.id === 'topLine' ? 30 : 70 }))

    const parsed = parseRoomCode(formatRoomCode(room({ conditions })))
    expect(parsed!.conditions).toEqual(conditions)
  })

  it('round-trips a single condition holding all 100 points', () => {
    const conditions = defaultConditions()
      .filter((c) => c.id === 'fullHouse')
      .map((c) => ({ ...c, points: 100 }))

    const parsed = parseRoomCode(formatRoomCode(room({ conditions })))
    expect(parsed!.conditions).toEqual(conditions)
  })

  it('stays typeable: seed plus at most nine more characters', () => {
    const code = formatRoomCode(room())
    expect(code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{1,9}$/)
  })

  it('is forgiving about case, spaces and hyphens', () => {
    const code = formatRoomCode(room())
    const mangled = `  ${code.toLowerCase().replace('-', '')}  `.replace(/(.{3})/, '$1 ')
    expect(parseRoomCode(mangled)).toEqual(parseRoomCode(code))
  })

  it('folds the look-alike characters instead of building a different room', () => {
    // A code containing O or I is the classic mis-read; it must land on the same room
    // as 0 and 1 rather than silently generating someone else's tickets.
    const parsed = parseRoomCode('OOOO1-')
    expect(parsed).not.toBeNull()
    expect(parsed!.seed).toBe(parseRoomCode('00001')!.seed)
  })

  it('drops custom conditions — a typed code cannot carry them (PRD D1)', () => {
    const conditions = [...defaultConditions().slice(0, 2), CUSTOM]
    const config = room({ conditions })

    expect(hasCustomConditions(config)).toBe(true)
    const parsed = parseRoomCode(formatRoomCode(config))
    expect(parsed!.conditions.map((c) => c.id)).toEqual(['earlyFive', 'topLine'])
  })

  it('carries the seed alone when the payload is missing', () => {
    const code = formatRoomCode(room()).split('-')[0]
    const parsed = parseRoomCode(code)
    expect(parsed!.seed).toBe(1234567)
    expect(parsed!.conditions).toEqual([])
  })

  it('rejects a code that is too short or has an impossible character', () => {
    expect(parseRoomCode('K3P')).toBeNull()
    expect(parseRoomCode('K3P9$-1')).toBeNull()
    expect(parseRoomCode('')).toBeNull()
  })

  it('rejects a payload whose points cannot add up to 100', () => {
    // Every preset on, and the five encoded points already over 100 — the sixth
    // would have to be negative. Better rejected than shown as a broken prize list.
    const conditions = defaultConditions().map((c) => ({ ...c, points: 25 }))
    const broken = formatRoomCode(room({ conditions }))
    expect(parseRoomCode(broken)).toBeNull()
  })

  it('room code + seat number rebuilds the same ticket ID the conductor printed', () => {
    // This is the whole point of "the room code IS the seed": no lookup, no server.
    const config = room()
    const parsed = parseRoomCode(formatRoomCode(config))!
    const seat = 4

    expect(formatTicketId(parsed.seed, seat)).toBe(formatTicketId(config.seed, seat))
    expect(parseTicketId(formatTicketId(parsed.seed, seat))).toEqual({
      setSeed: config.seed,
      index: seat,
    })
  })
})

describe('config blob (QR links)', () => {
  it('round-trips a whole room, custom conditions included', () => {
    const config = room({
      conditions: [...defaultConditions().slice(0, 3), CUSTOM],
      ticketsPerPlayer: 2,
    })
    expect(decodeRoomConfig(encodeRoomConfig(config))).toEqual(config)
  })

  it('keeps a non-ASCII room name intact', () => {
    const config = room({ name: 'दिवाली 2026' })
    expect(decodeRoomConfig(encodeRoomConfig(config))!.name).toBe('दिवाली 2026')
  })

  it('is URL-fragment safe', () => {
    const encoded = encodeRoomConfig(room({ name: 'Ravi & Co / #1 party?' }))
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(encodeURIComponent(encoded)).toBe(encoded)
  })

  it('rejects a truncated or corrupted blob rather than half-decoding it', () => {
    const encoded = encodeRoomConfig(room())
    expect(decodeRoomConfig(encoded.slice(0, encoded.length - 4))).toBeNull()
    expect(decodeRoomConfig('')).toBeNull()
    expect(decodeRoomConfig('not-a-blob')).toBeNull()
  })

  it('rejects a blob from a different format version', () => {
    // Hand-built v2 blob: a future link opened by this build must be refused, not read.
    const future = btoa(JSON.stringify([2, 'x', 1, 1, 1, []]))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(decodeRoomConfig(future)).toBeNull()
  })
})
