import { describe, it, expect } from 'vitest'
import { drawOrder } from '../engine/caller'
import { defaultConditions } from '../engine/patterns'
import type { RoomConfig } from '../engine/room'
import type { Ruling, StoredGame } from './game'
import { resultsText } from './results'

const CONFIG: RoomConfig = {
  name: 'Diwali 2026',
  seed: 123456,
  playerCount: 4,
  ticketsPerPlayer: 1,
  conditions: defaultConditions(),
  strictClaimTiming: false,
}

function gameWith(rulings: Ruling[]): StoredGame {
  const callSeed = 4242
  return {
    callSeed,
    history: drawOrder(callSeed).slice(0, 45),
    rulings,
    ended: true,
  }
}

function ruling(conditionId: string, seat: number, valid: boolean, atCall = 20): Ruling {
  return { conditionId, seat, valid, atCall }
}

describe('the results as text', () => {
  it('names the room and how far the draw got', () => {
    const text = resultsText(CONFIG, {}, gameWith([]))
    expect(text).toContain('Tambola — Diwali 2026')
    expect(text).toContain('45 numbers called')
    expect(text).toContain('Nobody claimed anything this game.')
  })

  it('lists a seat with its label, its prizes and its bogeys', () => {
    const text = resultsText(
      CONFIG,
      { 0: 'Priya' },
      gameWith([ruling('earlyFive', 0, true), ruling('corners', 0, false)]),
    )
    expect(text).toContain('Priya · seat 00 — 10 pts')
    expect(text).toContain('  Early Five — 10 pts')
    expect(text).toContain('  1 bogey')
  })

  it('shows a tie as the share, not the face value', () => {
    // Full House is 35 by default, so two winners are 18 and 17 — the odd point goes to
    // the lower seat (splitPoints), and the text has to agree with the screen.
    const text = resultsText(
      CONFIG,
      {},
      gameWith([ruling('fullHouse', 1, true), ruling('fullHouse', 3, true)]),
    )
    expect(text).toContain('Seat 01 — 18 pts')
    expect(text).toContain('  Full House — 18 pts · tied with seat 03')
    expect(text).toContain('Seat 03 — 17 pts')
    expect(text).toContain('  Full House — 17 pts · tied with seat 01')
  })

  it('lists the conditions nobody took', () => {
    const text = resultsText(CONFIG, {}, gameWith([ruling('earlyFive', 0, true)]))
    expect(text).toContain('Nobody won')

    // Everything after that heading is the unclaimed list, so the condition that WAS
    // won must not appear in it (it appears above, under the seat that took it).
    const unclaimed = text.slice(text.indexOf('Nobody won'))
    expect(unclaimed).toContain('Full House — 35 pts')
    expect(unclaimed).not.toContain('Early Five')
  })
})
