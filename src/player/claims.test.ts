import { describe, it, expect, beforeEach } from 'vitest'
import { installMockLocalStorage } from '../test/mockLocalStorage'
import { defaultConditions } from '../engine/patterns'
import {
  clearClaims,
  formatShare,
  loadClaims,
  pointsWon,
  saveClaims,
  withClaim,
  type ClaimLog,
} from './claims'

const TICKET = 'K3P9Z-04'

/** A won prize, shared however many ways. */
function won(winners = 1) {
  return { state: 'won' as const, winners }
}

beforeEach(() => {
  installMockLocalStorage()
})

describe('the player claim log', () => {
  it('starts empty and round-trips', () => {
    expect(loadClaims(TICKET)).toEqual({})

    saveClaims(TICKET, { topLine: won(), fullHouse: { state: 'bogey', winners: 1 } })
    expect(loadClaims(TICKET)).toEqual({
      topLine: won(),
      fullHouse: { state: 'bogey', winners: 1 },
    })
  })

  it('round-trips a shared prize', () => {
    saveClaims(TICKET, { fullHouse: won(3) })
    expect(loadClaims(TICKET).fullHouse).toEqual(won(3))
  })

  it('keeps one ticket’s claims out of another’s', () => {
    saveClaims(TICKET, { topLine: won() })
    expect(loadClaims('K3P9Z-05')).toEqual({})
  })

  it('drops states it does not recognise rather than trusting storage', () => {
    const store = installMockLocalStorage()
    store.setItem(
      `tambola:player:claims:${TICKET}`,
      '{"topLine":{"state":"won","winners":1},"middleLine":{"state":"verified"},"bottomLine":7}',
    )
    expect(loadClaims(TICKET)).toEqual({ topLine: won() })
  })

  it('reads the old bare-string shape as a prize won outright', () => {
    // What this file wrote before prizes could be shared. A player mid-game when the
    // app updates keeps their notes rather than losing them.
    const store = installMockLocalStorage()
    store.setItem(
      `tambola:player:claims:${TICKET}`,
      '{"topLine":"won","fullHouse":"bogey"}',
    )
    expect(loadClaims(TICKET)).toEqual({
      topLine: won(),
      fullHouse: { state: 'bogey', winners: 1 },
    })
  })

  it('clamps a winner count that storage says is impossible', () => {
    const store = installMockLocalStorage()
    store.setItem(
      `tambola:player:claims:${TICKET}`,
      '{"topLine":{"state":"won","winners":0},"fullHouse":{"state":"won","winners":900}}',
    )
    const log = loadClaims(TICKET)
    expect(log.topLine.winners).toBe(1)
    expect(log.fullHouse.winners).toBe(8)
  })

  it('clears one ticket', () => {
    saveClaims(TICKET, { topLine: won() })
    clearClaims(TICKET)
    expect(loadClaims(TICKET)).toEqual({})
  })
})

describe('withClaim', () => {
  it('sets, overwrites and clears without mutating the original', () => {
    const first: ClaimLog = {}
    const claimed = withClaim(first, 'topLine', 'claimed')
    const win = withClaim(claimed, 'topLine', 'won')

    expect(first).toEqual({})
    expect(claimed).toEqual({ topLine: { state: 'claimed', winners: 1 } })
    expect(win).toEqual({ topLine: won() })
    expect(withClaim(win, 'topLine', null)).toEqual({})
  })

  it('keeps the split when only the state changes, and the other way round', () => {
    const shared = withClaim({}, 'fullHouse', 'won', 3)
    expect(shared.fullHouse).toEqual(won(3))

    // Re-recording the state must not silently reset the split back to 1.
    expect(withClaim(shared, 'fullHouse', 'won').fullHouse).toEqual(won(3))
    // And changing the split must not disturb the state.
    expect(withClaim(shared, 'fullHouse', 'won', 2).fullHouse).toEqual(won(2))
  })
})

describe('a share of a tied prize', () => {
  it('is the whole prize when nobody shared it', () => {
    expect(formatShare(35, 1)).toBe('35 pts')
  })

  it('is one number when the split is even', () => {
    expect(formatShare(30, 2)).toBe('15 pts')
    expect(formatShare(30, 3)).toBe('10 pts')
  })

  it('is a range when it is not, because this phone cannot know which way it fell', () => {
    // The conductor gives the odd point to the lowest seat number; the player heard
    // how many ways it went, not which seats.
    expect(formatShare(35, 2)).toBe('17–18 pts')
    expect(formatShare(10, 3)).toBe('3–4 pts')
  })
})

describe('pointsWon', () => {
  it('counts wins only — not claims in flight, not bogeys', () => {
    const conditions = defaultConditions()
    const topLine = conditions.find((condition) => condition.id === 'topLine')!

    expect(
      pointsWon(conditions, {
        topLine: won(),
        middleLine: { state: 'claimed', winners: 1 },
        fullHouse: { state: 'bogey', winners: 1 },
      }),
    ).toEqual({ low: topLine.points, high: topLine.points })
  })

  it('adds up the shares of shared prizes, as a range', () => {
    const conditions = defaultConditions()
    // topLine 15 shared 2 ways = 7 or 8; fullHouse 35 shared 2 ways = 17 or 18.
    expect(pointsWon(conditions, { topLine: won(2), fullHouse: won(2) })).toEqual({
      low: 24,
      high: 26,
    })
  })

  it('is zero with nothing recorded', () => {
    expect(pointsWon(defaultConditions(), {})).toEqual({ low: 0, high: 0 })
  })
})
