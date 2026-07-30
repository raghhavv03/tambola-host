import { describe, it, expect, beforeEach } from 'vitest'
import {
  installMockLocalStorage,
  type MockLocalStorage,
} from '../test/mockLocalStorage'
import { STORAGE_KEYS, loadJSON, saveJSON, clearKey } from './storage'

let store: MockLocalStorage

beforeEach(() => {
  store = installMockLocalStorage()
})

describe('conductor storage', () => {
  it('round-trips a value', () => {
    expect(saveJSON(STORAGE_KEYS.game, { seed: 42, history: [7, 3] })).toBe(true)
    expect(loadJSON(STORAGE_KEYS.game)).toEqual({ seed: 42, history: [7, 3] })
  })

  it('returns null when nothing was saved', () => {
    expect(loadJSON(STORAGE_KEYS.room)).toBeNull()
  })

  it('returns null on malformed JSON rather than throwing', () => {
    store.setItem(STORAGE_KEYS.game, '{not json')
    expect(loadJSON(STORAGE_KEYS.game)).toBeNull()
  })

  it('reports a failed write instead of pretending it saved', () => {
    store.failNextWrite()
    expect(saveJSON(STORAGE_KEYS.game, { seed: 1 })).toBe(false)
  })

  it('clears a key', () => {
    saveJSON(STORAGE_KEYS.room, { name: 'Diwali' })
    clearKey(STORAGE_KEYS.room)
    expect(loadJSON(STORAGE_KEYS.room)).toBeNull()
  })
})
