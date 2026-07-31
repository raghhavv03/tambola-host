// A room: everything the conductor decided before the first number came out, and the
// two ways that decision travels to a player's phone.
//
// Pure TypeScript, same rules as the rest of src/engine: no React, no app imports, no
// network, no storage. This file only turns a room into a string and back.
//
// --- The two carriers, and why they differ -------------------------------------
//
// 1. THE ROOM CODE — what the conductor reads out loud and a player types. It has to
//    survive being shouted across a room, so it is short and made of unambiguous
//    characters. Short means it cannot carry arbitrary text: custom condition NAMES do
//    not compress into something typeable. So the code carries the seed plus which
//    PRESET conditions are in play and their points, and nothing else.
//
// 2. THE CONFIG BLOB — what rides in a QR link's fragment. A URL has no meaningful
//    length limit, so this carries the whole room: name, custom conditions, the lot.
//
// That asymmetry is decision D1 in PRD.md, accepted deliberately: a code-joiner gets a
// working ticket and the preset prize list; custom conditions travel by QR only, and
// the setup screen says so. The real fix is a backend, which is a later phase.
//
// Neither carrier is a channel. Both are read ONCE, at open time, from the string the
// player was given. Nothing flows back, and nothing updates afterwards — see THE
// AIRGAP in CLAUDE.md.

import { BASE32_BITS, base32Digit, encodeBase32, BASE32_ALPHABET } from './base32'
import {
  PRESETS,
  findPreset,
  isPresetId,
  patternFromMask,
  patternToMask,
  TOTAL_POINTS,
  type Condition,
} from './patterns'

/** A room, as set up by the conductor. */
export interface RoomConfig {
  /** Free text, e.g. "Diwali 2026". Shown to the conductor and to players. */
  name: string
  /** The ticket-set seed. This IS the room code's seed part: code + seat = ticket ID. */
  seed: number
  /** How many players the conductor is issuing tickets to. */
  playerCount: number
  /** Tickets each player holds. 1 unless the conductor says otherwise. */
  ticketsPerPlayer: number
  /** What the room is playing for, and the points split. Must total 100 to start. */
  conditions: Condition[]
  /**
   * The strict-timing house rule (PRD.md §7.4): a claim whose pattern was already
   * complete several numbers ago counts as late, and the conductor may rule it a
   * bogey even though the ticket is mechanically valid. Off by default — plenty of
   * rooms play it lenient, and this is a house rule rather than universal law.
   *
   * NEITHER CARRIER CARRIES THIS, on purpose. It is a rule about how the conductor
   * RULES, and the ruling happens entirely on the conductor's device; a player's
   * phone would only ever display it. So it stays out of the room code and out of the
   * QR blob, `decodeRoomConfig` reads it back as false, and the conductor announces
   * the house rule out loud the way they announce every other one.
   */
  strictClaimTiming: boolean
}

// --- The seed ------------------------------------------------------------------
//
// 25 bits = exactly 5 base32 characters = 33.5 million rooms. The width is FIXED so a
// room code can be split into "seed" and "rules" by position alone, with no separator
// to lose when someone reads it out. 33.5 million is plenty: seeds only need to be
// unguessable-ish within one party, and a room lives for one evening.

export const SEED_BITS = 25
export const SEED_CHARS = SEED_BITS / BASE32_BITS // 5
const SEED_LIMIT = 2 ** SEED_BITS

// Smallest seed that writes as five base32 characters without padding. Room codes pad
// to a fixed width, but a TICKET ID doesn't (formatTicketId pads the index, not the
// seed) — so a small seed would print "34Z-00" on tickets while the conductor read
// "0034Z" out to the room. Same value, two different-looking strings, in the one place
// where people are already squinting. Drawing above this line costs 3% of the seed
// space and makes the two always match.
const SMALLEST_FULL_WIDTH_SEED = 32 ** (SEED_CHARS - 1)

/** A fresh random seed for a new room. Math.random is fine — this picks the seed, and
 *  everything downstream is deterministic from it. */
export function randomSeed(): number {
  const span = SEED_LIMIT - SMALLEST_FULL_WIDTH_SEED
  return SMALLEST_FULL_WIDTH_SEED + Math.floor(Math.random() * span)
}

// --- Bit plumbing for the room code --------------------------------------------
//
// The rules payload is a handful of small integers, so we pack it bit by bit and then
// slice the bit string into 5-bit base32 characters. Boring and inspectable, which
// matters more here than speed — this runs once per room, not once per frame.

function writeBits(bits: number[], value: number, width: number): void {
  for (let i = width - 1; i >= 0; i--) bits.push((value >> i) & 1)
}

function bitsToBase32(bits: number[]): string {
  let out = ''
  for (let i = 0; i < bits.length; i += BASE32_BITS) {
    let digit = 0
    for (let j = 0; j < BASE32_BITS; j++) {
      // Past the end of the payload we pad with zero bits. The decoder checks those
      // padding bits are still zero, which catches a mistyped final character.
      digit = (digit << 1) | (bits[i + j] ?? 0)
    }
    out += BASE32_ALPHABET[digit]
  }
  return out
}

function base32ToBits(text: string): number[] | null {
  const bits: number[] = []
  for (const char of text) {
    const digit = base32Digit(char)
    if (digit === null) return null
    writeBits(bits, digit, BASE32_BITS)
  }
  return bits
}

/** Reads a bit string left to right. Returns null once it runs past the end. */
function bitReader(bits: number[]) {
  let at = 0
  return {
    read(width: number): number | null {
      if (at + width > bits.length) return null
      let value = 0
      for (let i = 0; i < width; i++) value = (value << 1) | bits[at + i]
      at += width
      return value
    },
    /** True when every remaining bit is a zero — i.e. only padding is left. */
    restIsPadding(): boolean {
      return bits.slice(at).every((bit) => bit === 0)
    },
    used(): number {
      return at
    },
  }
}

// --- The room code -------------------------------------------------------------
//
// Layout: 5 characters of seed, then the rules payload, joined by a hyphen for
// legibility ("K3P9Z-7QW3"). The payload is:
//
//   6 bits  one per preset, in PRESETS order, set when the room plays that condition
//   7 bits  points for EACH active preset, including the last one
//
// So a six-preset room is 6 + 42 = 48 bits = 10 payload characters; a three-condition
// room is 6. Longer than the "8-10 characters" sketch in PRD.md §12 when all six are
// on — the alternative was quantising points to multiples of 5, which is a real
// product restriction traded for two characters. Not worth it.
//
// --- Why the last one is not derived --------------------------------------------
//
// The obvious saving is to leave the last preset's points out and compute them as
// "the rest of 100", since a room's split has to total exactly 100 to start. That is
// only true of the WHOLE split, though — and a room code carries the presets alone.
// Put 10 points on anything a code can't carry (a custom pattern, a second full
// house) and the presets no longer total 100, so the derived value silently absorbs
// every missing condition's points: the conductor's ledger says Full House is 25 and
// the code-joiner's phone says 35. A wrong number is worse than a long code, so all
// six are written out and the decoder accepts any total up to 100.

const PRESET_BITS = PRESETS.length // 6
const POINTS_BITS = 7 // 0..100 fits in 7 bits

/** Does this room have conditions a typed code cannot carry? The setup screen warns. */
export function hasCustomConditions(config: RoomConfig): boolean {
  return config.conditions.some((condition) => !isPresetId(condition.id))
}

/**
 * The code the conductor reads out. Carries the seed always, and the preset conditions
 * with their points when there are any.
 */
export function formatRoomCode(config: RoomConfig): string {
  const seedPart = encodeBase32(config.seed % SEED_LIMIT, SEED_CHARS)

  // In PRESETS order, not the conductor's order — the mask is positional.
  const active = PRESETS.map((preset) =>
    config.conditions.find((condition) => condition.id === preset.id),
  )
  const activeConditions = active.filter((c): c is Condition => c !== undefined)
  if (activeConditions.length === 0) return seedPart

  const bits: number[] = []
  for (const condition of active) writeBits(bits, condition ? 1 : 0, 1)
  for (const condition of activeConditions) {
    writeBits(bits, Math.max(0, Math.min(TOTAL_POINTS, condition.points)), POINTS_BITS)
  }

  return `${seedPart}-${bitsToBase32(bits)}`
}

/** What a typed room code turns into. Conditions are empty when the code carried none. */
export interface ParsedRoomCode {
  seed: number
  conditions: Condition[]
}

/**
 * Parse a code a player typed. Forgiving about case, spaces and hyphens (they are
 * squinting at a phone in a loud room), strict about everything else: a code that
 * doesn't decode cleanly returns null so the join screen can say "check that code"
 * rather than silently building the wrong ticket.
 */
export function parseRoomCode(raw: string): ParsedRoomCode | null {
  // Hyphens are cosmetic — the seed is fixed-width, so position alone splits it.
  const cleaned = raw.toUpperCase().replace(/[\s-]/g, '')
  if (cleaned.length < SEED_CHARS) return null

  const seedPart = cleaned.slice(0, SEED_CHARS)
  const payloadPart = cleaned.slice(SEED_CHARS)

  const bits = base32ToBits(seedPart)
  if (bits === null) return null
  const seed = bitReader(bits).read(SEED_BITS)
  if (seed === null) return null

  if (payloadPart.length === 0) return { seed, conditions: [] }

  const conditions = decodePresetPayload(payloadPart)
  return conditions === null ? null : { seed, conditions }
}

/** The rules half of a room code. Null if it is malformed or doesn't add up to 100. */
function decodePresetPayload(payload: string): Condition[] | null {
  const bits = base32ToBits(payload)
  if (bits === null) return null

  const reader = bitReader(bits)
  const mask = reader.read(PRESET_BITS)
  if (mask === null) return null

  const active = PRESETS.filter((_, i) => (mask & (1 << (PRESET_BITS - 1 - i))) !== 0)
  if (active.length === 0) return null

  const points: number[] = []
  for (let i = 0; i < active.length; i++) {
    const value = reader.read(POINTS_BITS)
    if (value === null) return null
    // Every condition is worth something (pointsProblem enforces it at setup), so a
    // zero here means a mistyped character rather than a real prize.
    if (value < 1 || value > TOTAL_POINTS) return null
    points.push(value)
  }

  // At most 100 between them, not exactly 100: the rest may be sitting on conditions
  // this code cannot carry. Over 100 is impossible in a real room, so it was mistyped
  // — better rejected than shown as a broken prize list.
  if (points.reduce((sum, p) => sum + p, 0) > TOTAL_POINTS) return null

  // Anything after the fields we read must be zero padding, and there must be less
  // than a whole character of it — otherwise this isn't the payload we wrote.
  if (!reader.restIsPadding()) return null
  if (bits.length - reader.used() >= BASE32_BITS) return null

  return active.map((preset, i) => ({
    id: preset.id,
    name: preset.name,
    pattern: preset.pattern,
    points: points[i],
  }))
}

// --- The config blob (QR links) ------------------------------------------------
//
// The whole room, base64url so it can sit in a URL fragment untouched. Serialised as
// nested arrays rather than an object because the field names would be most of the
// payload, and a QR's density is what decides whether a phone camera can read it from
// across a table.
//
// Version number first: an old QR opened by a newer build must be rejected outright
// rather than misread. There is no server to re-issue links, so this is the only
// safety net a stale link gets.

const BLOB_VERSION = 1

/** [version, name, seed, playerCount, ticketsPerPlayer, [[id, name, mask, required, points], …]] */
type RoomBlob = [
  number,
  string,
  number,
  number,
  number,
  [string, string, number, number, number][],
]

/** UTF-8 text to base64url. TextEncoder, not btoa directly, so a Hindi room name
 *  survives — btoa throws on anything outside Latin-1. */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** base64url back to UTF-8 text. Null if it isn't valid base64url at all. */
function fromBase64Url(encoded: string): string | null {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/** The whole room as one URL-safe string, for a QR link. */
export function encodeRoomConfig(config: RoomConfig): string {
  const blob: RoomBlob = [
    BLOB_VERSION,
    config.name,
    config.seed,
    config.playerCount,
    config.ticketsPerPlayer,
    config.conditions.map((condition) => [
      condition.id,
      // A preset's name is already known to every build, so don't spend QR pixels on
      // it. Custom names have to travel.
      isPresetId(condition.id) ? '' : condition.name,
      patternToMask(condition.pattern),
      condition.pattern.required,
      condition.points,
    ]),
  ]
  return toBase64Url(JSON.stringify(blob))
}

/**
 * Rebuild a room from a QR link. Null on anything unexpected — a wrong version, a
 * truncated link, a field of the wrong type. A player whose link doesn't decode is
 * told to rescan; a player whose link half-decodes would play a different game from
 * everyone else in the room.
 */
export function decodeRoomConfig(encoded: string): RoomConfig | null {
  const json = fromBase64Url(encoded)
  if (json === null) return null

  let blob: unknown
  try {
    blob = JSON.parse(json)
  } catch {
    return null
  }

  if (!Array.isArray(blob) || blob.length !== 6) return null
  const [version, name, seed, playerCount, ticketsPerPlayer, rawConditions] = blob as RoomBlob
  if (version !== BLOB_VERSION) return null
  if (typeof name !== 'string' || typeof seed !== 'number') return null
  if (typeof playerCount !== 'number' || typeof ticketsPerPlayer !== 'number') return null
  if (!Array.isArray(rawConditions)) return null

  const conditions: Condition[] = []
  for (const entry of rawConditions) {
    if (!Array.isArray(entry) || entry.length !== 5) return null
    const [id, customName, mask, required, points] = entry
    if (typeof id !== 'string' || typeof customName !== 'string') return null
    if (typeof mask !== 'number' || typeof required !== 'number') return null
    if (typeof points !== 'number') return null

    const preset = findPreset(id)
    conditions.push({
      id,
      name: preset ? preset.name : customName,
      pattern: patternFromMask(mask, required),
      points,
    })
  }

  // strictClaimTiming is deliberately not in the blob — see the field's note in
  // RoomConfig. A decoded room is a player's copy, and a player never rules on
  // anything, so false is not a guess here: it is the only value that means anything
  // on this side of the airgap.
  return { name, seed, playerCount, ticketsPerPlayer, conditions, strictClaimTiming: false }
}
