// The conductor's saved room: the setup they filled in, plus which seats have
// actually been handed out.
//
// This is the only thing P2 persists. It lives under `tambola:room:setup` (see
// storage.ts) and is read back on every load, so a conductor who locks their phone
// halfway through handing out tickets comes back to the same list.
//
// Everything here is conductor-side by definition — the player's bundle can never
// import it, and src/player/airgap.test.ts fails the build if it ever does.

import {
  makePattern,
  type Condition,
  type Pattern,
} from '../engine/patterns'
import type { RoomConfig } from '../engine/room'
import { STORAGE_KEYS, loadJSON, saveJSON, clearKey } from './storage'

/**
 * Names the conductor privately attached to seats, keyed by seat number.
 *
 * A seat with no entry here is simply "Seat 04" everywhere, which is what every seat
 * was before this existed — naming is optional at every seat, not all-or-nothing.
 */
export type SeatNames = Record<number, string>

/** A room as it sits on disk. */
export interface StoredRoom {
  config: RoomConfig
  /** Seat numbers already given to a person. Seat number = ticket index. */
  issuedSeats: number[]
  /**
   * Optional labels for seats. Conductor-side only: this is NOT part of RoomConfig, so
   * it rides in neither carrier — not the room code, not the QR blob — and the player's
   * bundle has no idea it exists. It is a note the conductor keeps about a seat number
   * they already control, so that the results screen reads out "Priya · seat 04"
   * instead of a room full of strangers' seat numbers.
   */
  seatNames: SeatNames
}

// Bumped if the shape below ever changes. An unrecognised version is discarded
// rather than guessed at: a half-understood room would hand out wrong tickets.
const STORED_VERSION = 1

interface StoredRecord extends StoredRoom {
  version: number
}

// --- Seats ---------------------------------------------------------------------
//
// A seat number IS the ticket's index in the set, so seat 04 of room K3P9Z is the
// ticket printed "K3P9Z-04". They are the same number on purpose: when a player
// shouts, the conductor can type either one and get the same ticket. That is also
// why seats start at 00 rather than 01.

/** How many tickets this room needs in total. */
export function ticketCount(config: RoomConfig): number {
  return config.playerCount * config.ticketsPerPlayer
}

/** Which player (1-based, for reading out) holds a given seat. */
export function playerOfSeat(seat: number, ticketsPerPlayer: number): number {
  return Math.floor(seat / Math.max(1, ticketsPerPlayer)) + 1
}

/** Seat number as it is printed and read out: zero-padded to two digits. */
export function formatSeat(seat: number): string {
  return String(seat).padStart(2, '0')
}

/**
 * How long a seat name is allowed to be.
 *
 * Long enough for "Priya's mum", short enough that a name plus a seat number still fits
 * on one line of a phone next to a points figure. Names are typed at the party, not
 * imported from anywhere, so this only ever catches a lean on the keyboard.
 */
export const MAX_SEAT_NAME = 24

/** Trim and cap whatever was typed. An empty result means "this seat has no name". */
function cleanSeatName(raw: string): string {
  return raw.trim().slice(0, MAX_SEAT_NAME)
}

/**
 * Set (or clear) one seat's name, returning a new map.
 *
 * Typing the field empty REMOVES the entry rather than storing an empty string, so
 * "has a name" is one check everywhere else and a cleared field can't leave a seat
 * labelled "· seat 04".
 *
 * The value is capped but NOT trimmed, because this runs on every keystroke of a
 * controlled input: trimming here would eat the space in "Priya K" the moment it was
 * typed, and the second word could never be started. Whitespace-only is still nothing,
 * and `parseStoredRoom` trims on the way back in, so a stray trailing space lives no
 * longer than the conductor's next reload.
 */
export function withSeatName(
  seatNames: SeatNames,
  seat: number,
  name: string,
): SeatNames {
  const next = { ...seatNames }
  const kept = name.slice(0, MAX_SEAT_NAME)
  if (kept.trim().length === 0) {
    delete next[seat]
  } else {
    next[seat] = kept
  }
  return next
}

/**
 * A seat as the conductor should read it out: "Priya · seat 04", or "Seat 04" when
 * nobody put a name on it.
 *
 * The seat number is always there, even alongside a name — it is what the ticket in
 * the player's hand is printed with, and it is what settles an argument when two people
 * at a party turn out to be called the same thing.
 */
export function seatLabel(seat: number, seatNames: SeatNames): string {
  const name = seatNames[seat]
  return name === undefined ? `Seat ${formatSeat(seat)}` : `${name} · seat ${formatSeat(seat)}`
}

/** The same label mid-sentence, where a capital S would read as a new sentence. */
export function seatLabelInline(seat: number, seatNames: SeatNames): string {
  const name = seatNames[seat]
  return name === undefined ? `seat ${formatSeat(seat)}` : `${name} · seat ${formatSeat(seat)}`
}

/**
 * Mark a batch of seats as given out, returning the new list sorted and de-duplicated
 * exactly the way the one-seat-at-a-time toggle keeps it.
 *
 * One tap per seat is fine for a family game and unworkable for thirty players: a page
 * of six is one action while a room full of people waits, not six. This only ever ADDS
 * — there is no bulk undo, because "un-give a whole page" is not a thing that happens
 * at a party, and it is the one action that could quietly put a seat back on screen
 * after somebody already walked away with it.
 */
export function withSeatsIssued(issuedSeats: number[], seats: number[]): number[] {
  const issued = new Set(issuedSeats)
  for (const seat of seats) issued.add(seat)
  return [...issued].sort((a, b) => a - b)
}

// --- Persistence ---------------------------------------------------------------

/** Save the room. Returns false when storage is blocked or full. */
export function saveRoom(room: StoredRoom): boolean {
  const record: StoredRecord = { version: STORED_VERSION, ...room }
  return saveJSON(STORAGE_KEYS.room, record)
}

/** Forget the room entirely — the conductor starting a different game. */
export function clearRoom(): void {
  clearKey(STORAGE_KEYS.room)
}

/** Read the saved room back, or null when there isn't one (or it isn't readable). */
export function loadRoom(): StoredRoom | null {
  return parseStoredRoom(loadJSON<unknown>(STORAGE_KEYS.room))
}

/**
 * Validate whatever came out of localStorage.
 *
 * Storage is not a trusted input: it survives deploys, so a record written by an
 * older build (or edited by hand in devtools) can turn up here. Anything that isn't
 * exactly the shape we wrote is thrown away and the conductor starts fresh, which is
 * a small annoyance — whereas a partially-read room means tickets that don't match
 * the ones already in players' hands.
 */
export function parseStoredRoom(raw: unknown): StoredRoom | null {
  if (!isRecord(raw)) return null
  if (raw.version !== STORED_VERSION) return null

  const config = parseConfig(raw.config)
  if (config === null) return null

  const total = ticketCount(config)
  const issuedSeats = Array.isArray(raw.issuedSeats)
    ? raw.issuedSeats.filter(
        (seat): seat is number =>
          typeof seat === 'number' && Number.isInteger(seat) && seat >= 0 && seat < total,
      )
    : []

  return {
    config,
    issuedSeats: [...new Set(issuedSeats)].sort((a, b) => a - b),
    seatNames: parseSeatNames(raw.seatNames, total),
  }
}

/**
 * Read the seat names back, dropping anything that isn't one.
 *
 * Tolerant on purpose, the same way `strictClaimTiming` is: a room saved before names
 * existed simply has no field here, and throwing away a set-up room over a missing
 * optional label would be a far worse trade than starting with no names.
 */
function parseSeatNames(raw: unknown, total: number): SeatNames {
  if (!isRecord(raw)) return {}

  const names: SeatNames = {}
  for (const [key, value] of Object.entries(raw)) {
    // JSON object keys are strings, so the seat number comes back as "4", not 4.
    const seat = Number(key)
    if (!Number.isInteger(seat) || seat < 0 || seat >= total) continue
    if (typeof value !== 'string') continue
    // Names for seats that no longer exist are dropped for the same reason issued seats
    // are: the conductor shrank the room, and a label on a seat nobody holds is a ghost.
    const name = cleanSeatName(value)
    if (name.length > 0) names[seat] = name
  }
  return names
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseConfig(raw: unknown): RoomConfig | null {
  if (!isRecord(raw)) return null
  if (typeof raw.name !== 'string') return null
  if (!isCount(raw.seed)) return null
  if (!isCount(raw.playerCount) || raw.playerCount < 1) return null
  if (!isCount(raw.ticketsPerPlayer) || raw.ticketsPerPlayer < 1) return null
  if (!Array.isArray(raw.conditions)) return null

  const conditions: Condition[] = []
  for (const entry of raw.conditions) {
    const condition = parseCondition(entry)
    if (condition === null) return null
    conditions.push(condition)
  }

  return {
    name: raw.name,
    seed: raw.seed,
    playerCount: raw.playerCount,
    ticketsPerPlayer: raw.ticketsPerPlayer,
    conditions,
    // Read tolerantly rather than demanded: a room saved before the strict-timing rule
    // existed simply doesn't have the field, and losing a set-up room over a missing
    // boolean would be a worse trade than defaulting it to the off position it would
    // have had anyway.
    strictClaimTiming: raw.strictClaimTiming === true,
  }
}

function parseCondition(raw: unknown): Condition | null {
  if (!isRecord(raw)) return null
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null
  if (typeof raw.name !== 'string') return null
  if (typeof raw.points !== 'number' || !Number.isFinite(raw.points)) return null

  const pattern = parsePattern(raw.pattern)
  if (pattern === null) return null

  return { id: raw.id, name: raw.name, pattern, points: raw.points }
}

function parsePattern(raw: unknown): Pattern | null {
  if (!isRecord(raw)) return null
  if (!Array.isArray(raw.cells) || raw.cells.length === 0) return null
  if (!raw.cells.every((cell) => typeof cell === 'number')) return null
  if (!isCount(raw.required) || raw.required < 1) return null

  // makePattern drops out-of-range cells and clamps `required`, so a pattern that
  // survives this is one verifyClaim can use unchanged.
  const pattern = makePattern(raw.cells as number[], raw.required)
  return pattern.cells.length === 0 ? null : pattern
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}
