import { describe, it, expect } from 'vitest'
import {
  CELL_COUNT,
  PRESETS,
  DEFAULT_PRESET_POINTS,
  cellAt,
  rowOfCell,
  positionOfCell,
  makePattern,
  patternToMask,
  patternFromMask,
  findPreset,
  isPresetId,
  defaultConditions,
  pointsTotal,
  pointsProblem,
  TOTAL_POINTS,
  type Condition,
} from './patterns'

describe('logical cells', () => {
  it('round-trips row and position', () => {
    for (let row = 0; row < 3; row++) {
      for (let position = 0; position < 5; position++) {
        const cell = cellAt(row, position)
        expect(rowOfCell(cell)).toBe(row)
        expect(positionOfCell(cell)).toBe(position)
      }
    }
  })

  it('covers 0..14 with no gaps or overlaps', () => {
    const cells = new Set<number>()
    for (let row = 0; row < 3; row++) {
      for (let position = 0; position < 5; position++) cells.add(cellAt(row, position))
    }
    expect(cells.size).toBe(CELL_COUNT)
  })
})

describe('makePattern', () => {
  it('sorts, de-duplicates and drops out-of-range cells', () => {
    const pattern = makePattern([9, 3, 3, -1, 15, 100, 0])
    expect(pattern.cells).toEqual([0, 3, 9])
    expect(pattern.required).toBe(3) // defaults to "all of them"
  })

  it('clamps required into 1..cells.length', () => {
    expect(makePattern([1, 2, 3], 0).required).toBe(1)
    expect(makePattern([1, 2, 3], 99).required).toBe(3)
    expect(makePattern([1, 2, 3], 2).required).toBe(2)
  })
})

describe('presets', () => {
  it('has the six standard conditions in a fixed wire order', () => {
    // This order is baked into the room code's preset bitmask. If this test fails
    // because someone reordered PRESETS, every room code ever printed now decodes
    // into a different game — fix the code, not the test.
    expect(PRESETS.map((p) => p.id)).toEqual([
      'earlyFive',
      'topLine',
      'middleLine',
      'bottomLine',
      'corners',
      'fullHouse',
    ])
  })

  it('shapes each preset the way tambola actually plays', () => {
    expect(findPreset('topLine')!.pattern.cells).toEqual([0, 1, 2, 3, 4])
    expect(findPreset('middleLine')!.pattern.cells).toEqual([5, 6, 7, 8, 9])
    expect(findPreset('bottomLine')!.pattern.cells).toEqual([10, 11, 12, 13, 14])
    expect(findPreset('corners')!.pattern.cells).toEqual([0, 4, 10, 14])

    // Early Five and Full House share the whole grid and differ only in `required`.
    const early = findPreset('earlyFive')!.pattern
    const full = findPreset('fullHouse')!.pattern
    expect(early.cells).toEqual(full.cells)
    expect(early.required).toBe(5)
    expect(full.required).toBe(15)
  })

  it('recognises preset ids and rejects custom ones', () => {
    expect(isPresetId('corners')).toBe(true)
    expect(isPresetId('custom-1')).toBe(false)
    expect(findPreset('custom-1')).toBeNull()
  })
})

describe('pattern masks', () => {
  it('round-trips every preset', () => {
    for (const preset of PRESETS) {
      const mask = patternToMask(preset.pattern)
      expect(patternFromMask(mask, preset.pattern.required)).toEqual(preset.pattern)
    }
  })

  it('round-trips an arbitrary custom shape', () => {
    const pattern = makePattern([0, 4, 7, 11, 14], 3)
    expect(patternFromMask(patternToMask(pattern), pattern.required)).toEqual(pattern)
  })

  it('uses one bit per logical cell', () => {
    expect(patternToMask(makePattern([0]))).toBe(1)
    expect(patternToMask(makePattern([14]))).toBe(1 << 14)
    expect(patternToMask(makePattern([0, 1, 2, 3, 4]))).toBe(0b11111)
  })
})

describe('points', () => {
  it('ships a default split that already totals 100', () => {
    const conditions = defaultConditions()
    expect(conditions.length).toBe(PRESETS.length)
    expect(pointsTotal(conditions)).toBe(TOTAL_POINTS)
    expect(pointsProblem(conditions)).toBeNull()
    expect(conditions[0].points).toBe(DEFAULT_PRESET_POINTS.earlyFive)
  })

  it('blocks an unbalanced split and says by how much', () => {
    const under: Condition[] = [{ ...defaultConditions()[0], points: 40 }]
    expect(pointsProblem(under)).toContain('60')

    const over = defaultConditions().map((c) => ({ ...c, points: c.points + 5 }))
    expect(pointsProblem(over)).toContain('30') // 130 assigned, 30 too many
  })

  it('blocks a condition with no points at all', () => {
    const conditions = defaultConditions().map((c, i) =>
      i === 0 ? { ...c, points: 0 } : c,
    )
    expect(pointsProblem(conditions)).toContain('Early Five')
  })

  it('blocks a room with no conditions', () => {
    expect(pointsProblem([])).not.toBeNull()
  })
})
