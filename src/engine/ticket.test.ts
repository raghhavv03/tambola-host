import { describe, it, expect } from 'vitest'
import {
  generateTicket,
  generateSet,
  verifyClaim,
  patternNumbers,
  type Ticket,
} from './ticket'
import { findPreset, makePattern, cellAt, type Pattern } from './patterns'

// The preset patterns, by the ids the conductor's ledger uses.
function preset(id: string): Pattern {
  const found = findPreset(id)
  if (found === null) throw new Error(`no preset "${id}"`)
  return found.pattern
}

// Column c holds numbers in this inclusive range.
function columnRange(col: number): [number, number] {
  const low = col === 0 ? 1 : col * 10
  const high = col === 8 ? 90 : col * 10 + 9
  return [low, high]
}

// Every non-null number on the ticket, left-to-right then top-to-bottom.
function allNumbers(ticket: Ticket): number[] {
  return ticket.flat().filter((c): c is number => c !== null)
}

describe('generateTicket — structural constraints (1000 tickets)', () => {
  // One loop, many asserts: if any single generated ticket breaks a rule, the failing
  // seed is reported so it's reproducible.
  it('holds every constraint across 1000 seeds', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const ticket = generateTicket(seed)
      const where = `seed ${seed}` // shows up in the assertion message on failure

      // Shape: 3 rows × 9 columns.
      expect(ticket.length, where).toBe(3)
      for (const row of ticket) expect(row.length, where).toBe(9)

      // Exactly 15 numbers and 12 blanks.
      const numbers = allNumbers(ticket)
      expect(numbers.length, where).toBe(15)
      const blanks = ticket.flat().filter((c) => c === null).length
      expect(blanks, where).toBe(12)

      // Exactly 5 numbers per row.
      for (let r = 0; r < 3; r++) {
        const count = ticket[r].filter((c) => c !== null).length
        expect(count, `${where} row ${r}`).toBe(5)
      }

      // Each column: 1–3 numbers, all inside that column's range, sorted top→bottom.
      for (let c = 0; c < 9; c++) {
        const colCells = [ticket[0][c], ticket[1][c], ticket[2][c]]
        const colNums = colCells.filter((v): v is number => v !== null)

        expect(colNums.length, `${where} col ${c} count`).toBeGreaterThanOrEqual(1)
        expect(colNums.length, `${where} col ${c} count`).toBeLessThanOrEqual(3)

        const [low, high] = columnRange(c)
        for (const n of colNums) {
          expect(n, `${where} col ${c} range`).toBeGreaterThanOrEqual(low)
          expect(n, `${where} col ${c} range`).toBeLessThanOrEqual(high)
        }

        // Strictly increasing top to bottom.
        for (let i = 1; i < colNums.length; i++) {
          expect(colNums[i], `${where} col ${c} sort`).toBeGreaterThan(colNums[i - 1])
        }
      }

      // No number appears twice anywhere on the ticket.
      expect(new Set(numbers).size, where).toBe(15)
    }
  })
})

describe('generateTicket — determinism', () => {
  it('same seed produces an identical ticket', () => {
    expect(generateTicket(123)).toEqual(generateTicket(123))
  })

  it('different seeds usually differ', () => {
    expect(generateTicket(1)).not.toEqual(generateTicket(2))
  })
})

describe('generateSet', () => {
  it('produces n distinct tickets, each valid', () => {
    const tickets = generateSet(100, 7)
    expect(tickets.length).toBe(100)

    const keys = tickets.map((t) =>
      t.map((row) => row.map((c) => c ?? '_').join(',')).join('|'),
    )
    expect(new Set(keys).size).toBe(100) // all distinct

    for (const t of tickets) {
      expect(allNumbers(t).length).toBe(15) // sanity: each is a real ticket
    }
  })

  it('is deterministic for the same (n, seed)', () => {
    expect(generateSet(20, 42)).toEqual(generateSet(20, 42))
  })
})

describe('verifyClaim', () => {
  // A fixed ticket to build claim scenarios against.
  const ticket = generateTicket(2024)
  const row0 = ticket[0].filter((c): c is number => c !== null)
  const row1 = ticket[1].filter((c): c is number => c !== null)
  const row2 = ticket[2].filter((c): c is number => c !== null)
  const everyNumber = allNumbers(ticket)
  const corners = [row0[0], row0[row0.length - 1], row2[0], row2[row2.length - 1]]

  it('earlyFive: valid at exactly 5 marked', () => {
    const res = verifyClaim(ticket, everyNumber.slice(0, 5), preset('earlyFive'))
    expect(res.valid).toBe(true)
    expect(res.marked.length).toBe(5)
  })

  it('earlyFive: invalid at only 4 marked', () => {
    const res = verifyClaim(ticket, everyNumber.slice(0, 4), preset('earlyFive'))
    expect(res.valid).toBe(false)
    expect(res.marked.length).toBe(4)
  })

  it('earlyFive: still valid (and counts all) when more than 5 are called', () => {
    const res = verifyClaim(ticket, everyNumber, preset('earlyFive'))
    expect(res.valid).toBe(true)
    expect(res.marked.length).toBe(15)
    expect(res.missing.length).toBe(0)
  })

  it('topLine: valid only when all 5 of row 0 are called', () => {
    const full = verifyClaim(ticket, row0, preset('topLine'))
    expect(full.valid).toBe(true)
    expect(full.marked.sort((a, b) => a - b)).toEqual([...row0].sort((a, b) => a - b))
    expect(full.missing).toEqual([])

    const short = verifyClaim(ticket, row0.slice(0, 4), preset('topLine'))
    expect(short.valid).toBe(false)
    expect(short.missing).toEqual([row0[4]]) // the one left out
  })

  it('middleLine and bottomLine work on their own rows', () => {
    expect(verifyClaim(ticket, row1, preset('middleLine')).valid).toBe(true)
    expect(verifyClaim(ticket, row2, preset('bottomLine')).valid).toBe(true)
    // Calling row 0's numbers does NOT satisfy a middle-line claim.
    expect(verifyClaim(ticket, row0, preset('middleLine')).valid).toBe(false)
  })

  it('corners: needs exactly the 4 extreme numbers of top and bottom rows', () => {
    const res = verifyClaim(ticket, corners, preset('corners'))
    expect(res.valid).toBe(true)
    expect(res.marked.length).toBe(4)

    // Missing any one corner invalidates it.
    const short = verifyClaim(ticket, corners.slice(0, 3), preset('corners'))
    expect(short.valid).toBe(false)
    expect(short.missing).toEqual([corners[3]])

    // A middle-row number is irrelevant to corners: calling all of row 1 does nothing.
    expect(verifyClaim(ticket, row1, preset('corners')).valid).toBe(false)
  })

  it('fullHouse: valid only with all 15', () => {
    expect(verifyClaim(ticket, everyNumber, preset('fullHouse')).valid).toBe(true)

    const missingOne = everyNumber.slice(0, 14)
    const res = verifyClaim(ticket, missingOne, preset('fullHouse'))
    expect(res.valid).toBe(false)
    expect(res.missing).toEqual([everyNumber[14]])
    expect(res.marked.length).toBe(14)
  })

  it('ignores called numbers that are not on the ticket', () => {
    // Row 0 complete, plus a pile of irrelevant called numbers — still a valid topLine
    // and the extras don't leak into marked/missing.
    const res = verifyClaim(ticket, [...row0, 999, 1000], preset('topLine'))
    expect(res.valid).toBe(true)
    expect(res.marked.length).toBe(5)
  })

  it('verifies a custom pattern the same way as a preset', () => {
    // "Middle three of the middle row" — a shape no preset covers.
    const custom = makePattern([cellAt(1, 1), cellAt(1, 2), cellAt(1, 3)])
    const wanted = [row1[1], row1[2], row1[3]]

    expect(verifyClaim(ticket, wanted, custom).valid).toBe(true)
    const short = verifyClaim(ticket, wanted.slice(0, 2), custom)
    expect(short.valid).toBe(false)
    expect(short.missing).toEqual([row1[3]])
    expect(short.required).toBe(3)
  })

  it('a custom "any N" pattern needs only N of its cells', () => {
    // Any 2 of the four corners.
    const anyTwoCorners = makePattern(
      [cellAt(0, 0), cellAt(0, 4), cellAt(2, 0), cellAt(2, 4)],
      2,
    )
    expect(verifyClaim(ticket, corners.slice(0, 2), anyTwoCorners).valid).toBe(true)
    expect(verifyClaim(ticket, corners.slice(0, 1), anyTwoCorners).valid).toBe(false)
  })
})

describe('patternNumbers — the logical grid resolves on every ticket', () => {
  it('maps corners to the first and last number of the top and bottom rows', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const t = generateTicket(seed)
      const top = t[0].filter((c): c is number => c !== null)
      const bottom = t[2].filter((c): c is number => c !== null)

      expect(patternNumbers(t, preset('corners')), `seed ${seed}`).toEqual([
        top[0],
        top[4],
        bottom[0],
        bottom[4],
      ])
    }
  })

  it('resolves every logical cell to a real number on any ticket', () => {
    const wholeGrid = makePattern(Array.from({ length: 15 }, (_, cell) => cell))
    for (let seed = 1; seed <= 200; seed++) {
      const numbers = patternNumbers(generateTicket(seed), wholeGrid)
      expect(numbers.length, `seed ${seed}`).toBe(15)
      expect(numbers.every((n) => typeof n === 'number'), `seed ${seed}`).toBe(true)
    }
  })
})
