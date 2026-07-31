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
  /**
   * true = the claim held and the condition is won; false = a bogey.
   *
   * A condition can carry more than one valid ruling: that is a tie, recorded
   * deliberately by the conductor when two people shouted at the same moment and
   * they can't honestly say who was first. Its points then split between them
   * (PRD.md §7.5, `splitPoints` below).
   */
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

/**
 * Every seat that won a condition, in the order they were ruled.
 *
 * Usually one: the first valid claim closes a condition (PRD.md §7.3). More than one
 * means the conductor explicitly ruled a tie, and the points split (§7.5). Seats are
 * de-duplicated, so a condition recorded twice against the same seat — a double-tap,
 * or a hand-edited storage record — can't inflate that seat's share.
 */
export function winnersOf(rulings: readonly Ruling[], conditionId: string): number[] {
  const seats = rulings
    .filter((r) => r.conditionId === conditionId && r.valid)
    .map((r) => r.seat)
  return [...new Set(seats)]
}

/** Is this condition still up for grabs? */
export function isOpen(rulings: readonly Ruling[], conditionId: string): boolean {
  return winnersOf(rulings, conditionId).length === 0
}

/**
 * How a condition's points divide between the seats that won it.
 *
 * Even split, and the remainder that won't divide (15 points between 2) goes to the
 * lowest seat numbers. Something has to break the tie in the last point, and seat
 * order is the one rule that is arbitrary in a way nobody can argue with afterwards —
 * it is fixed before the game starts and visible to everyone. The results screen shows
 * each share, so nobody has to do this arithmetic by hand.
 *
 * @returns one entry per seat, ascending by seat. Empty in, empty out.
 */
export function splitPoints(
  points: number,
  seats: readonly number[],
): { seat: number; points: number }[] {
  const ordered = [...new Set(seats)].sort((a, b) => a - b)
  if (ordered.length === 0) return []

  const base = Math.floor(points / ordered.length)
  const remainder = points % ordered.length
  return ordered.map((seat, i) => ({ seat, points: base + (i < remainder ? 1 : 0) }))
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
  return config.conditions.filter((c) => isOpen(rulings, c.id))
}

/** One condition a seat won, and what that was actually worth to them. */
export interface SeatWin {
  condition: Condition
  /** This seat's share. Equal to `condition.points` unless it was a tie. */
  points: number
  /** The other seats it was tied with, ascending. Empty when won outright. */
  sharedWith: number[]
}

/** What one seat walked away with. */
export interface SeatScore {
  seat: number
  /** Sum of this seat's shares. Out of 100 for the room. */
  points: number
  won: SeatWin[]
  bogeys: number
}

/**
 * The scoreboard: every seat that won or bogeyed anything, best first.
 *
 * Seats that neither won nor bogeyed are left out — a list of forty "0 pts" rows is
 * noise on a phone, and the conductor knows who was in the room.
 */
export function seatScores(config: RoomConfig, rulings: readonly Ruling[]): SeatScore[] {
  // Split each condition once and file the shares under their seat, rather than asking
  // "what did seat N win" per seat — a split only makes sense looked at whole.
  const winsBySeat = new Map<number, SeatWin[]>()
  for (const condition of config.conditions) {
    const winners = winnersOf(rulings, condition.id)
    for (const share of splitPoints(condition.points, winners)) {
      const won = winsBySeat.get(share.seat) ?? []
      won.push({
        condition,
        points: share.points,
        sharedWith: winners.filter((s) => s !== share.seat).sort((a, b) => a - b),
      })
      winsBySeat.set(share.seat, won)
    }
  }

  // Anyone who claimed anything at all, win or bogey.
  const seats = [...new Set(rulings.map((r) => r.seat))]
  const scores = seats.map((seat) => {
    const won = winsBySeat.get(seat) ?? []
    return {
      seat,
      won,
      points: won.reduce((sum, win) => sum + win.points, 0),
      bogeys: bogeyCount(rulings, seat),
    }
  })

  // Most points first; ties fall back to seat order so the list never jumps around.
  return scores.sort((a, b) => b.points - a.points || a.seat - b.seat)
}

/** Every condition has a winner — the natural end of the game. */
export function allConditionsWon(config: RoomConfig, rulings: readonly Ruling[]): boolean {
  return (
    config.conditions.length > 0 && config.conditions.every((c) => !isOpen(rulings, c.id))
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
