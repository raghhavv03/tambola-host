import { describe, it, expect, beforeEach } from 'vitest'
import { installMockLocalStorage } from '../test/mockLocalStorage'
import { defaultConditions } from '../engine/patterns'
import {
  clearClaims,
  loadClaims,
  pointsWon,
  saveClaims,
  withClaim,
  type ClaimLog,
} from './claims'

const TICKET = 'K3P9Z-04'

beforeEach(() => {
  installMockLocalStorage()
})

describe('the player claim log', () => {
  it('starts empty and round-trips', () => {
    expect(loadClaims(TICKET)).toEqual({})

    saveClaims(TICKET, { topLine: 'won', fullHouse: 'bogey' })
    expect(loadClaims(TICKET)).toEqual({ topLine: 'won', fullHouse: 'bogey' })
  })

  it('keeps one ticket’s claims out of another’s', () => {
    saveClaims(TICKET, { topLine: 'won' })
    expect(loadClaims('K3P9Z-05')).toEqual({})
  })

  it('drops states it does not recognise rather than trusting storage', () => {
    const store = installMockLocalStorage()
    store.setItem(
      `tambola:player:claims:${TICKET}`,
      '{"topLine":"won","middleLine":"verified","bottomLine":7}',
    )
    expect(loadClaims(TICKET)).toEqual({ topLine: 'won' })
  })

  it('clears one ticket', () => {
    saveClaims(TICKET, { topLine: 'won' })
    clearClaims(TICKET)
    expect(loadClaims(TICKET)).toEqual({})
  })
})

describe('withClaim', () => {
  it('sets, overwrites and clears without mutating the original', () => {
    const first: ClaimLog = {}
    const claimed = withClaim(first, 'topLine', 'claimed')
    const won = withClaim(claimed, 'topLine', 'won')

    expect(first).toEqual({})
    expect(claimed).toEqual({ topLine: 'claimed' })
    expect(won).toEqual({ topLine: 'won' })
    expect(withClaim(won, 'topLine', null)).toEqual({})
  })
})

describe('pointsWon', () => {
  it('counts wins only — not claims in flight, not bogeys', () => {
    const conditions = defaultConditions()
    const topLine = conditions.find((condition) => condition.id === 'topLine')!

    expect(
      pointsWon(conditions, {
        topLine: 'won',
        middleLine: 'claimed',
        fullHouse: 'bogey',
      }),
    ).toBe(topLine.points)
  })

  it('is zero with nothing recorded', () => {
    expect(pointsWon(defaultConditions(), {})).toBe(0)
  })
})
