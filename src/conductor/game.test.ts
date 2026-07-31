import { describe, it, expect, beforeEach } from 'vitest'
import { drawOrder } from '../engine/caller'
import { defaultConditions } from '../engine/patterns'
import type { RoomConfig } from '../engine/room'
import { installMockLocalStorage } from '../test/mockLocalStorage'
import {
  allConditionsWon,
  bogeyCount,
  clearGame,
  hasBogeyed,
  isFrozen,
  latestCall,
  loadGame,
  newGame,
  canTie,
  isOpen,
  openConditions,
  parseStoredGame,
  saveGame,
  seatScores,
  splitPoints,
  winnersOf,
  type Ruling,
  type StoredGame,
} from './game'

const CONFIG: RoomConfig = {
  name: 'Diwali 2026',
  seed: 123456,
  playerCount: 6,
  ticketsPerPlayer: 1,
  conditions: defaultConditions(),
  strictClaimTiming: false,
}

/** A game a few numbers into its draw. */
function gameAfter(calls: number, rulings: Ruling[] = []): StoredGame {
  const callSeed = 4242
  return {
    callSeed,
    history: drawOrder(callSeed).slice(0, calls),
    rulings,
    ended: false,
  }
}

function ruling(conditionId: string, seat: number, valid: boolean): Ruling {
  return { conditionId, seat, valid, atCall: 10 }
}

beforeEach(() => {
  installMockLocalStorage()
})

describe('a new game', () => {
  it('starts empty and unfrozen', () => {
    const game = newGame()
    expect(game.history).toEqual([])
    expect(game.rulings).toEqual([])
    expect(game.ended).toBe(false)
    expect(isFrozen(game)).toBe(false)
    expect(latestCall(game)).toBeNull()
  })

  it('freezes the rules from the first number out', () => {
    expect(isFrozen(null)).toBe(false)
    expect(isFrozen(gameAfter(1))).toBe(true)
  })

  it('reports the number just called', () => {
    const game = gameAfter(3)
    expect(latestCall(game)).toBe(game.history[2])
  })
})

describe('rulings', () => {
  it('closes a condition to a valid claim', () => {
    const rulings = [ruling('topLine', 3, true)]
    expect(winnersOf(rulings, 'topLine')).toEqual([3])
    expect(isOpen(rulings, 'topLine')).toBe(false)
    expect(winnersOf(rulings, 'fullHouse')).toEqual([])
    expect(isOpen(rulings, 'fullHouse')).toBe(true)
  })

  it('treats a second valid claim on one condition as a tie', () => {
    const rulings = [ruling('topLine', 3, true), ruling('topLine', 5, true)]
    expect(winnersOf(rulings, 'topLine')).toEqual([3, 5])
  })

  it('does not let one seat win the same condition twice', () => {
    const rulings = [ruling('topLine', 3, true), ruling('topLine', 3, true)]
    expect(winnersOf(rulings, 'topLine')).toEqual([3])
  })

  it('a bogey does not close a condition', () => {
    const rulings = [ruling('topLine', 3, false)]
    expect(winnersOf(rulings, 'topLine')).toEqual([])
    expect(openConditions(CONFIG, rulings).map((c) => c.id)).toContain('topLine')
  })

  it('marks a seat ineligible for the condition it bogeyed, and only that one', () => {
    const rulings = [ruling('topLine', 3, false)]
    expect(hasBogeyed(rulings, 'topLine', 3)).toBe(true)
    expect(hasBogeyed(rulings, 'topLine', 4)).toBe(false)
    expect(hasBogeyed(rulings, 'middleLine', 3)).toBe(false)
  })

  it('counts bogeys per seat across conditions', () => {
    const rulings = [
      ruling('topLine', 3, false),
      ruling('middleLine', 3, false),
      ruling('corners', 5, false),
      ruling('fullHouse', 3, true),
    ]
    expect(bogeyCount(rulings, 3)).toBe(2)
    expect(bogeyCount(rulings, 5)).toBe(1)
    expect(bogeyCount(rulings, 0)).toBe(0)
  })

  it('knows when every condition has been won', () => {
    expect(allConditionsWon(CONFIG, [])).toBe(false)
    const all = CONFIG.conditions.map((c, i) => ruling(c.id, i, true))
    expect(allConditionsWon(CONFIG, all)).toBe(true)
  })
})

describe('the scoreboard', () => {
  it('totals the points of the conditions each seat won, best first', () => {
    // fullHouse = 35, topLine = 15, earlyFive = 10 in the default split.
    const rulings = [
      ruling('topLine', 1, true),
      ruling('fullHouse', 2, true),
      ruling('earlyFive', 1, true),
      ruling('corners', 1, false),
    ]
    const scores = seatScores(CONFIG, rulings)

    // Seat 2 took the 35-point Full House; seat 1's two conditions come to 25.
    expect(scores.map((s) => s.seat)).toEqual([2, 1])
    expect(scores[0].points).toBe(35)
    expect(scores[1].points).toBe(25)
    expect(scores[1].won.map((w) => w.condition.id)).toEqual(['earlyFive', 'topLine'])
    expect(scores[1].won.every((w) => w.sharedWith.length === 0)).toBe(true)
    expect(scores[1].bogeys).toBe(1)
  })

  it('lists a seat that only bogeyed, on zero points', () => {
    const scores = seatScores(CONFIG, [ruling('topLine', 4, false)])
    expect(scores).toEqual([{ seat: 4, points: 0, won: [], bogeys: 1 }])
  })

  it('is empty when nobody claimed anything', () => {
    expect(seatScores(CONFIG, [])).toEqual([])
  })
})

describe('splitting a tied condition', () => {
  it('divides evenly when it divides evenly', () => {
    expect(splitPoints(30, [4, 1])).toEqual([
      { seat: 1, points: 15 },
      { seat: 4, points: 15 },
    ])
  })

  it('gives the remainder to the lowest seats', () => {
    // 35 between 2 is 17.5; seat 1 takes the odd point.
    expect(splitPoints(35, [7, 1])).toEqual([
      { seat: 1, points: 18 },
      { seat: 7, points: 17 },
    ])
    // 35 between 4 is 8.75; the first three seats take a point each.
    expect(splitPoints(35, [3, 0, 9, 6])).toEqual([
      { seat: 0, points: 9 },
      { seat: 3, points: 9 },
      { seat: 6, points: 9 },
      { seat: 9, points: 8 },
    ])
  })

  it('never invents or loses a point, however it divides', () => {
    for (let winners = 1; winners <= 6; winners++) {
      const seats = Array.from({ length: winners }, (_, i) => i)
      for (let points = 1; points <= 100; points++) {
        const shares = splitPoints(points, seats)
        expect(shares.reduce((sum, s) => sum + s.points, 0)).toBe(points)
      }
    }
  })

  it('has nothing to split between nobody', () => {
    expect(splitPoints(40, [])).toEqual([])
  })

  it('shows up on the scoreboard as a share, with who it was shared with', () => {
    // fullHouse = 35 in the default split, tied between seats 2 and 5.
    const rulings = [ruling('fullHouse', 5, true), ruling('fullHouse', 2, true)]
    const scores = seatScores(CONFIG, rulings)

    expect(scores.map((s) => s.seat)).toEqual([2, 5])
    expect(scores[0].points).toBe(18)
    expect(scores[1].points).toBe(17)
    expect(scores[0].won[0].sharedWith).toEqual([5])
    expect(scores[1].won[0].sharedWith).toEqual([2])
  })

  it('is only open on the number the condition was won on', () => {
    // ruling() records atCall 10, i.e. it was won on the 10th number.
    const rulings = [ruling('topLine', 3, true)]

    expect(canTie(rulings, 'topLine', 10)).toBe(true)
    // One more number out and the moment has passed — whoever holds it, holds it.
    expect(canTie(rulings, 'topLine', 11)).toBe(false)
  })

  it('is not open on a condition nobody has won — that one is simply still open', () => {
    expect(canTie([], 'topLine', 10)).toBe(false)
    expect(canTie([ruling('topLine', 3, false)], 'topLine', 10)).toBe(false)
  })

  it('stays open for a third claimant on the same number', () => {
    const rulings = [ruling('topLine', 3, true), ruling('topLine', 5, true)]
    expect(canTie(rulings, 'topLine', 10)).toBe(true)
    expect(canTie(rulings, 'topLine', 12)).toBe(false)
  })

  it('refuses to load a game whose winners were ruled on different numbers', () => {
    // A tie means one number (PRD.md §7.5), so this record was hand-edited.
    const game = gameAfter(20, [
      { conditionId: 'topLine', seat: 1, valid: true, atCall: 10 },
      { conditionId: 'topLine', seat: 2, valid: true, atCall: 14 },
    ])
    expect(parseStoredGame({ ...game, version: 1 }, CONFIG)).toBeNull()
  })

  it('loads a genuine tie, and bogeys on other numbers do not disturb it', () => {
    const game = gameAfter(20, [
      { conditionId: 'topLine', seat: 1, valid: true, atCall: 10 },
      { conditionId: 'topLine', seat: 2, valid: true, atCall: 10 },
      { conditionId: 'topLine', seat: 4, valid: false, atCall: 17 },
    ])
    expect(parseStoredGame({ ...game, version: 1 }, CONFIG)).not.toBeNull()
  })

  it('counts a tied condition as won, not open', () => {
    const rulings = CONFIG.conditions.flatMap((c) => [
      ruling(c.id, 0, true),
      ruling(c.id, 1, true),
    ])
    expect(openConditions(CONFIG, rulings)).toEqual([])
    expect(allConditionsWon(CONFIG, rulings)).toBe(true)
  })
})

describe('saving and resuming', () => {
  it('round-trips a game', () => {
    const game = gameAfter(12, [ruling('topLine', 2, true)])
    expect(saveGame(game)).toBe(true)
    expect(loadGame(CONFIG)).toEqual(game)
  })

  it('forgets the game when cleared', () => {
    saveGame(gameAfter(3))
    clearGame()
    expect(loadGame(CONFIG)).toBeNull()
  })

  it('rejects a history that is not the draw order for its seed', () => {
    const game = gameAfter(5)
    const tampered = { ...game, history: [...game.history].reverse(), version: 1 }
    expect(parseStoredGame(tampered, CONFIG)).toBeNull()
  })

  it('rejects a history longer than the pool', () => {
    const game = gameAfter(90)
    const tooLong = { ...game, history: [...game.history, 91], version: 1 }
    expect(parseStoredGame(tooLong, CONFIG)).toBeNull()
  })

  it('rejects a ruling for a condition this room is not playing', () => {
    const game = gameAfter(5, [ruling('somethingElse', 1, true)])
    expect(parseStoredGame({ ...game, version: 1 }, CONFIG)).toBeNull()
  })

  it('rejects a ruling for a seat this room does not have', () => {
    const game = gameAfter(5, [ruling('topLine', 99, true)])
    expect(parseStoredGame({ ...game, version: 1 }, CONFIG)).toBeNull()
  })

  it('rejects an unknown version rather than guessing at it', () => {
    const game = gameAfter(5)
    expect(parseStoredGame({ ...game, version: 99 }, CONFIG)).toBeNull()
    expect(parseStoredGame(null, CONFIG)).toBeNull()
    expect(parseStoredGame('nonsense', CONFIG)).toBeNull()
  })
})
