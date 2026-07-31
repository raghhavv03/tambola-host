import { describe, it, expect } from 'vitest'
import {
  formatRoomCode,
  parseRoomCode,
  encodeRoomConfig,
  decodeRoomConfig,
  uncarriedConditions,
  randomSeed,
  SEED_CHARS,
  type RoomConfig,
} from './room'
import {
  defaultConditions,
  findPreset,
  makePattern,
  cellAt,
  presetCopy,
  type Condition,
} from './patterns'
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
    strictClaimTiming: false,
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

  it('stays typeable: seed plus at most ten more characters', () => {
    const code = formatRoomCode(room())
    expect(code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{1,10}$/)
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

    expect(uncarriedConditions(config.conditions)).toEqual([CUSTOM])
    const parsed = parseRoomCode(formatRoomCode(config))
    expect(parsed!.conditions.map((c) => c.id)).toEqual(['earlyFive', 'topLine'])
  })

  it('keeps every preset on the points the conductor actually gave it', () => {
    // The presets here total 25; the other 75 sits on a condition the code cannot
    // carry. Deriving the last preset as "the rest of 100" would report Top Line as
    // 90 — a number the conductor's own ledger disagrees with.
    const conditions = [
      ...defaultConditions()
        .slice(0, 2)
        .map((c, i) => ({ ...c, points: i === 0 ? 10 : 15 })),
      { ...CUSTOM, points: 75 },
    ]

    const parsed = parseRoomCode(formatRoomCode(room({ conditions })))
    expect(parsed!.conditions.map((c) => [c.id, c.points])).toEqual([
      ['earlyFive', 10],
      ['topLine', 15],
    ])
  })

  it('round-trips a second full house — its name is generated, not typed', () => {
    // "Another" mints `fullHouse-2`, whose name comes from a preset every build knows.
    // Nothing free-text is involved, so unlike a hand-drawn pattern it fits in a code.
    const conditions = [
      ...defaultConditions().map((c) => ({
        ...c,
        points: c.id === 'fullHouse' ? 25 : c.points,
      })),
      presetCopy(findPreset('fullHouse')!, 2, 10),
    ]
    const config = room({ conditions })

    expect(uncarriedConditions(config.conditions)).toEqual([])
    const parsed = parseRoomCode(formatRoomCode(config))!
    expect(parsed.conditions).toEqual(conditions)
  })

  it('round-trips several copies of different presets', () => {
    const conditions = [
      { ...defaultConditions()[1], points: 40 }, // Top Line
      presetCopy(findPreset('topLine')!, 2, 30),
      presetCopy(findPreset('fullHouse')!, 5, 30),
    ]
    const parsed = parseRoomCode(formatRoomCode(room({ conditions })))!
    expect(parsed.conditions).toEqual(conditions)
  })

  it('carries a copy whose own preset the room turned off', () => {
    // "Another" is only offered next to an active preset, but the conductor can switch
    // that preset off afterwards. The copy is its own prize and stands alone.
    const conditions = [presetCopy(findPreset('fullHouse')!, 2, 100)]
    const parsed = parseRoomCode(formatRoomCode(room({ conditions })))!
    expect(parsed.conditions).toEqual(conditions)
  })

  it('leaves a sixth copy of a preset behind, like a hand-drawn one', () => {
    // The copy number field is two bits wide, so 2..5 travel and anything past that
    // goes by QR only. uncarriedConditions is what tells the conductor which.
    const conditions = [
      { ...defaultConditions()[5], points: 90 }, // Full House
      presetCopy(findPreset('fullHouse')!, 6, 10),
    ]
    const config = room({ conditions })

    expect(uncarriedConditions(config.conditions).map((c) => c.id)).toEqual([
      'fullHouse-6',
    ])
    const parsed = parseRoomCode(formatRoomCode(config))!
    expect(parsed.conditions.map((c) => c.id)).toEqual(['fullHouse'])
  })

  it('still reads a code written before copies existed, and writes the same one', () => {
    // Literal from a room set up by the previous build: the six presets on the default
    // split. The copy list ends with a 0 bit, which is what the old format's padding
    // already was — so an old code decodes unchanged AND a copy-less room still writes
    // the exact same characters. Nobody has to reissue anything.
    const legacy = 'FFX6X-ZH8F3RY54C'
    const parsed = parseRoomCode(legacy)!

    expect(parsed.conditions.map((c) => [c.id, c.points])).toEqual([
      ['earlyFive', 10],
      ['topLine', 15],
      ['middleLine', 15],
      ['bottomLine', 15],
      ['corners', 10],
      ['fullHouse', 35],
    ])
    expect(formatRoomCode(room({ seed: parsed.seed }))).toBe(legacy)
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

  it('rejects a payload whose points add up to more than 100', () => {
    // Six presets at 25 is 150 — impossible in a real room, so the code was mistyped.
    // Better rejected than shown as a broken prize list.
    const conditions = defaultConditions().map((c) => ({ ...c, points: 25 }))
    const broken = formatRoomCode(room({ conditions }))
    expect(parseRoomCode(broken)).toBeNull()
  })

  it('rejects a payload claiming a condition is worth nothing', () => {
    const conditions = defaultConditions().map((c) => ({ ...c, points: 0 }))
    expect(parseRoomCode(formatRoomCode(room({ conditions })))).toBeNull()
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
