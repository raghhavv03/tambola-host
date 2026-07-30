// The live game: how far through the draw the room has got, and how the conductor
// ruled on the claims people shouted.
//
// Conductor-side by definition — the player's bundle can never import it, and
// src/player/airgap.test.ts fails the build if it ever does. Nothing here is sent
// anywhere; it is saved under `tambola:room:game` (see storage.ts) so a locked phone
// or a stray reload mid-party comes back to the same game rather than restarting a
// room full of half-marked tickets.
//
// --- Why the history is a prefix, not a log ------------------------------------
//
// The draw order is fixed the moment `callSeed` is chosen, so the only thing a saved
// game really has to remember is HOW MANY numbers have come out. Keeping `history` as
// a prefix of `drawOrder(callSeed)` means drawing is "take one more", undo is "take one
// fewer", and the two can never disagree with each other. It also gives a free
// integrity check on load: a history that isn't that prefix didn't come from this seed.

import { drawOrder } from '../engine/caller'
import type { Condition } from '../engine/patterns'
import type { RoomConfig } from '../engine/room'
import { STORAGE_KEYS, loadJSON, saveJSON, clearKey } from './storage'
import { ticketCount } from './room'

/** How the conductor ruled on one shouted claim. */
export interface Ruling {
  /** Which condition was claimed. Matches a `Condition.id` in the room. */
  conditionId: string
  /** Which seat claimed it. Seat number = ticket index (see room.ts). */
  seat: number
  /** true = the claim held and the condition is won; false = a bogey. */
  valid: boolean
  /** How many numbers had been called when it was ruled. Orders the results list. */
  atCall: number
}

/** A game in progress, as it sits on disk. */
export interface StoredGame {
  /**
   * Seed for the draw order. Deliberately NOT the ticket seed: the same set of
   * tickets can be played twice in an evening and must not repeat the same draw.
   */
  callSeed: number
  /** Numbers called so far, oldest first. Always a prefix of drawOrder(callSeed). */
  history: number[]
  rulings: Ruling[]
  /** The conductor has called it a night. From here the screen shows results only. */
  ended: boolean
}

// Bumped if the shape above ever changes. An unrecognised version is discarded rather
// than guessed at — half a game is worse than none.
const STORED_VERSION = 1

interface StoredRecord extends StoredGame {
  version: number
}

/** A fresh game for a room whose tickets are already handed out. */
export function newGame(): StoredGame {
  return {
    // Math.random only picks the seed; everything downstream is deterministic from it,
    // exactly as in engine/caller.ts.
    callSeed: Math.floor(Math.random() * 0xffffffff),
    history: [],
    rulings: [],
    ended: false,
  }
}

// --- Reading the game ------------------------------------------------------------

/** Are the rules frozen? They are, from the first number out — PRD.md §5.1. */
export function isFrozen(game: StoredGame | null): boolean {
  return game !== null && game.history.length > 0
}

/** The number just called, or null before the first draw. */
export function latestCall(game: StoredGame): number | null {
  return game.history.length === 0 ? null : game.history[game.history.length - 1]
}

/** The winning ruling for a condition, or null while it is still open. */
export function winnerOf(rulings: readonly Ruling[], conditionId: string): Ruling | null {
  // First valid claim closes a condition (PRD.md §7.3), so the first match is the one.
  return rulings.find((r) => r.conditionId === conditionId && r.valid) ?? null
}

/** Has this seat already bogeyed this condition? If so it can never win it. */
export function hasBogeyed(
  rulings: readonly Ruling[],
  conditionId: string,
  seat: number,
): boolean {
  return rulings.some((r) => r.conditionId === conditionId && r.seat === seat && !r.valid)
}

/** How many bogeys a seat has called, across every condition. */
export function bogeyCount(rulings: readonly Ruling[], seat: number): number {
  return rulings.filter((r) => r.seat === seat && !r.valid).length
}

/** Conditions still up for grabs, in the conductor's own order. */
export function openConditions(
  config: RoomConfig,
  rulings: readonly Ruling[],
): Condition[] {
  return config.conditions.filter((c) => winnerOf(rulings, c.id) === null)
}

/** What one seat walked away with. */
export interface SeatScore {
  seat: number
  /** Sum of the points of every condition this seat won. Out of 100 for the room. */
  points: number
  won: Condition[]
  bogeys: number
}

/**
 * The scoreboard: every seat that won or bogeyed anything, best first.
 *
 * Seats that neither won nor bogeyed are left out — a list of forty "0 pts" rows is
 * noise on a phone, and the conductor knows who was in the room.
 */
export function seatScores(config: RoomConfig, rulings: readonly Ruling[]): SeatScore[] {
  const seats = [...new Set(rulings.map((r) => r.seat))]

  const scores = seats.map((seat) => {
    const won = config.conditions.filter((c) => winnerOf(rulings, c.id)?.seat === seat)
    return {
      seat,
      won,
      points: won.reduce((sum, c) => sum + c.points, 0),
      bogeys: bogeyCount(rulings, seat),
    }
  })

  // Most points first; ties fall back to seat order so the list never jumps around.
  return scores.sort((a, b) => b.points - a.points || a.seat - b.seat)
}

/** Every condition has a winner — the natural end of the game. */
export function allConditionsWon(config: RoomConfig, rulings: readonly Ruling[]): boolean {
  return (
    config.conditions.length > 0 &&
    config.conditions.every((c) => winnerOf(rulings, c.id) !== null)
  )
}

// --- Persistence -----------------------------------------------------------------

/** Save the game. Returns false when storage is blocked or full. */
export function saveGame(game: StoredGame): boolean {
  const record: StoredRecord = { version: STORED_VERSION, ...game }
  return saveJSON(STORAGE_KEYS.game, record)
}

/** Forget the game — a new game on the same tickets, or a whole new room. */
export function clearGame(): void {
  clearKey(STORAGE_KEYS.game)
}

/**
 * Read the saved game back for a given room, or null when there isn't a usable one.
 *
 * The room is needed because a ruling names a condition and a seat, and both only mean
 * something inside a particular room. A game saved against a room that has since been
 * replaced is not resumable, and resuming it anyway would rule on the wrong tickets.
 */
export function loadGame(config: RoomConfig): StoredGame | null {
  return parseStoredGame(loadJSON<unknown>(STORAGE_KEYS.game), config)
}

/**
 * Validate whatever came out of localStorage.
 *
 * Storage is not a trusted input: it survives deploys, so a record written by an older
 * build (or edited by hand in devtools) can turn up here. Anything that isn't exactly
 * the shape we wrote — including a history that this build's shuffle no longer produces
 * from that seed — is thrown away, and the conductor starts a fresh game. Losing a game
 * is a bad evening; resuming a game whose numbers don't match the ones already called
 * out loud is a worse one.
 */
export function parseStoredGame(raw: unknown, config: RoomConfig): StoredGame | null {
  if (!isRecord(raw)) return null
  if (raw.version !== STORED_VERSION) return null
  if (!isCount(raw.callSeed)) return null
  if (typeof raw.ended !== 'boolean') return null
  if (!Array.isArray(raw.history)) return null

  // The integrity check: the saved numbers must be exactly the front of this seed's
  // order. Anything else and the record didn't come from this seed.
  const order = drawOrder(raw.callSeed)
  const history = raw.history
  if (history.length > order.length) return null
  if (!history.every((n, i) => n === order[i])) return null

  const rulings = parseRulings(raw.rulings, config, history.length)
  if (rulings === null) return null

  return { callSeed: raw.callSeed, history: history as number[], rulings, ended: raw.ended }
}

function parseRulings(
  raw: unknown,
  config: RoomConfig,
  called: number,
): Ruling[] | null {
  if (!Array.isArray(raw)) return null

  const seats = ticketCount(config)
  const rulings: Ruling[] = []
  for (const entry of raw) {
    if (!isRecord(entry)) return null
    if (typeof entry.conditionId !== 'string') return null
    if (typeof entry.valid !== 'boolean') return null
    if (!isCount(entry.seat) || entry.seat >= seats) return null
    if (!isCount(entry.atCall) || entry.atCall > called) return null
    // A ruling about a condition this room isn't playing means the setup was edited
    // out from under it. Discard the lot rather than show a prize nobody played for.
    if (!config.conditions.some((c) => c.id === entry.conditionId)) return null

    rulings.push({
      conditionId: entry.conditionId,
      seat: entry.seat,
      valid: entry.valid,
      atCall: entry.atCall,
    })
  }
  return rulings
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}
