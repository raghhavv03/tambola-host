import { describe, it, expect } from 'vitest'
import { createCaller, drawOrder } from './caller'

// A fixed seed everywhere so every run is identical and failures are reproducible.
const SEED = 42

describe('createCaller', () => {
  it('draws all 90 numbers exactly once', () => {
    const caller = createCaller(SEED)
    const drawn: number[] = []
    for (let i = 0; i < 90; i++) {
      const n = caller.draw()
      expect(n).not.toBeNull()
      drawn.push(n as number)
    }
    // Every number 1..90 present, no repeats: sorting must give exactly [1..90].
    const sorted = [...drawn].sort((a, b) => a - b)
    expect(sorted).toEqual(Array.from({ length: 90 }, (_, i) => i + 1))
    // A Set of 90 draws having size 90 confirms no duplicates slipped in.
    expect(new Set(drawn).size).toBe(90)
  })

  it('returns null on the 91st draw', () => {
    const caller = createCaller(SEED)
    for (let i = 0; i < 90; i++) caller.draw()
    expect(caller.draw()).toBeNull()
    expect(caller.remaining).toEqual([]) // pool truly empty
  })

  it('undo after N draws restores state identical to N-1 draws', () => {
    const N = 30

    // Reference caller: draw N-1 times.
    const reference = createCaller(SEED)
    for (let i = 0; i < N - 1; i++) reference.draw()

    // Test caller: draw N times, then undo once.
    const caller = createCaller(SEED)
    for (let i = 0; i < N; i++) caller.draw()
    caller.undo()

    // Same seed + same net number of draws => identical observable state.
    expect(caller.history).toEqual(reference.history)
    expect(caller.remaining).toEqual(reference.remaining)
    expect([...caller.called]).toEqual([...reference.called])
  })

  it('undo at zero draws is a no-op', () => {
    const caller = createCaller(SEED)
    expect(caller.undo()).toBeNull()
    expect(caller.history).toEqual([])
    expect(caller.remaining.length).toBe(90)
    // Undo didn't corrupt anything: a following draw still works normally.
    expect(caller.draw()).not.toBeNull()
  })

  it('two callers with the same seed produce identical sequences', () => {
    const a = createCaller(SEED)
    const b = createCaller(SEED)
    const seqA: (number | null)[] = []
    const seqB: (number | null)[] = []
    for (let i = 0; i < 90; i++) {
      seqA.push(a.draw())
      seqB.push(b.draw())
    }
    expect(seqA).toEqual(seqB)
  })

  it('reset restores a full pool', () => {
    const caller = createCaller(SEED)
    for (let i = 0; i < 50; i++) caller.draw()
    caller.reset()

    expect(caller.history).toEqual([])
    expect(caller.remaining.length).toBe(90)
    expect(caller.called.size).toBe(0)

    // Reset keeps the same shuffle order, so a fresh caller with the same seed draws
    // the identical sequence after this one is reset.
    const fresh = createCaller(SEED)
    expect(caller.draw()).toBe(fresh.draw())
  })
})

describe('caller.seed', () => {
  it('exposes the seed a caller was built from', () => {
    const caller = createCaller(123)
    expect(caller.seed).toBe(123)
  })

  it('exposes a generated seed when none is given', () => {
    const caller = createCaller()
    expect(typeof caller.seed).toBe('number')
  })
})

describe('drawOrder', () => {
  it('is all 90 numbers, once each', () => {
    const order = drawOrder(SEED)
    expect(order.length).toBe(90)
    expect([...order].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 90 }, (_, i) => i + 1),
    )
  })

  it('is the same order a caller with that seed draws', () => {
    const caller = createCaller(SEED)
    const drawn = Array.from({ length: 90 }, () => caller.draw())
    expect(drawOrder(SEED)).toEqual(drawn)
  })

  it('is identical for the same seed and different for another', () => {
    expect(drawOrder(SEED)).toEqual(drawOrder(SEED))
    expect(drawOrder(SEED)).not.toEqual(drawOrder(SEED + 1))
  })
})
