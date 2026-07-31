// Winning conditions, as patterns on the 3x5 LOGICAL grid.
//
// Pure TypeScript, same rules as the rest of src/engine: no React, no app imports, no
// network, no storage.
//
// --- Why 3x5 and not 3x9 --------------------------------------------------------
//
// A printed ticket is 3 rows x 9 columns with 12 blanks. Every ticket has exactly five
// numbers per row, but WHICH columns those five land in differs from ticket to ticket.
// So a pattern drawn on the printed grid ("column 3, all three rows") is unsatisfiable
// on some tickets and trivial on others — it isn't a rule, it's a lottery.
//
// The logical grid drops the blanks: row r, position i = "the i-th number in row r,
// reading left to right", i in 0..4. On that grid "four corners" is exactly positions
// (0,0), (0,4), (2,0), (2,4) on every ticket that has ever existed. That is precisely
// why corners is a real tambola condition and "column 3" is not.
//
// A cell is stored as a single number 0..14 (row * 5 + position) so a pattern packs
// into a 15-bit mask — which is what lets a whole room's rules ride inside a QR link.

export const ROWS = 3
export const NUMBERS_PER_ROW = 5
/** Cells on the logical grid: 3 rows x 5 numbers. */
export const CELL_COUNT = ROWS * NUMBERS_PER_ROW

/** A position on the logical grid, 0..14. */
export type LogicalCell = number

/** Logical cell for the `position`-th number of `row`. */
export function cellAt(row: number, position: number): LogicalCell {
  return row * NUMBERS_PER_ROW + position
}

/** Which row a logical cell sits in. */
export function rowOfCell(cell: LogicalCell): number {
  return Math.floor(cell / NUMBERS_PER_ROW)
}

/** Which position within its row a logical cell sits in. */
export function positionOfCell(cell: LogicalCell): number {
  return cell % NUMBERS_PER_ROW
}

/**
 * What has to be marked for a claim to hold.
 *
 * `cells` is the region that counts; `required` is how many of them must actually be
 * marked. For nearly every pattern `required === cells.length` ("fill this shape"),
 * but Early Five is "any five anywhere", which is the whole ticket with required = 5.
 * Carrying `required` explicitly is what keeps verification to ONE code path instead
 * of a special case for Early Five.
 */
export interface Pattern {
  /** Logical cells that count toward the claim. Sorted, no duplicates. */
  cells: LogicalCell[]
  /** How many of `cells` must be marked. 1..cells.length. */
  required: number
}

/** A winning condition the room is playing for. */
export interface Condition {
  /** Stable key. Preset ids are the preset names; custom ones are minted at setup. */
  id: string
  /** What the conductor calls it out loud. */
  name: string
  pattern: Pattern
  /** Share of the 100 points at stake. See TOTAL_POINTS. */
  points: number
}

/**
 * Build a pattern from loose input: sorts, de-duplicates, drops out-of-range cells and
 * clamps `required` into 1..cells.length. The pattern editor hands over whatever the
 * conductor tapped, in tap order — this is the one place that gets normalised, so
 * everything downstream (masks, verification, equality) can assume clean input.
 */
export function makePattern(cells: LogicalCell[], required?: number): Pattern {
  const clean = [...new Set(cells)]
    .filter((cell) => Number.isInteger(cell) && cell >= 0 && cell < CELL_COUNT)
    .sort((a, b) => a - b)

  const want = required ?? clean.length
  return {
    cells: clean,
    required: Math.max(1, Math.min(clean.length, Math.floor(want))),
  }
}

/** Every cell on the grid, in order — the region Early Five and Full House both use. */
function allCells(): LogicalCell[] {
  return Array.from({ length: CELL_COUNT }, (_, cell) => cell)
}

/** Every cell of one row. */
function rowCells(row: number): LogicalCell[] {
  return Array.from({ length: NUMBERS_PER_ROW }, (_, i) => cellAt(row, i))
}

/** A preset is a condition without its points — the conductor assigns those at setup. */
export interface Preset {
  id: string
  name: string
  pattern: Pattern
}

/**
 * The six standard conditions.
 *
 * ORDER IS PART OF THE WIRE FORMAT. The room code packs "which presets is this room
 * playing" as one bit per entry, in this order. Reordering or removing an entry would
 * make every previously written room code decode into a different game. Append only.
 */
export const PRESETS: readonly Preset[] = [
  {
    id: 'earlyFive',
    name: 'Early Five',
    // Any five numbers anywhere: the whole grid, but only five of them needed.
    pattern: makePattern(allCells(), 5),
  },
  { id: 'topLine', name: 'Top Line', pattern: makePattern(rowCells(0)) },
  { id: 'middleLine', name: 'Middle Line', pattern: makePattern(rowCells(1)) },
  { id: 'bottomLine', name: 'Bottom Line', pattern: makePattern(rowCells(2)) },
  {
    id: 'corners',
    name: 'Four Corners',
    // First and last number of the top row, and of the bottom row.
    pattern: makePattern([cellAt(0, 0), cellAt(0, 4), cellAt(2, 0), cellAt(2, 4)]),
  },
  { id: 'fullHouse', name: 'Full House', pattern: makePattern(allCells()) },
]

/** Find a preset by id. Null when the id isn't a preset (i.e. it's a custom condition). */
export function findPreset(id: string): Preset | null {
  return PRESETS.find((preset) => preset.id === id) ?? null
}

/** Is this condition one of the built-ins? */
export function isPresetId(id: string): boolean {
  return findPreset(id) !== null
}

// --- Preset copies ---------------------------------------------------------------
//
// "Another" on the setup screen adds a SECOND prize for a pattern the room already
// plays: id `fullHouse-2`, name "Full House 2". Nothing about it is typed by the
// conductor — the pattern belongs to the preset and the name is generated from it —
// which is exactly why, unlike a hand-drawn condition, a copy compresses into a typed
// room code (see engine/room.ts). Everything else still treats it as a custom
// condition, because its id is not a preset id.
//
// These helpers are the ONE place that spelling lives, so the setup screen and the
// room code can never mint "Full House 2" two different ways.

/**
 * Highest copy number a room code can carry, because the code spends two bits on it.
 * A sixth prize for the same pattern is possible — it just travels by QR only.
 */
export const MAX_PRESET_COPY = 5

/** A copy, taken apart: which preset it repeats and which number it is. */
export interface PresetCopy {
  preset: Preset
  /** 2 for the second prize of that pattern, 3 for the third, and so on. */
  number: number
}

/** The id "Another" mints: `fullHouse-2`. */
export function presetCopyId(presetId: string, number: number): string {
  return `${presetId}-${number}`
}

/** The name "Another" mints: "Full House 2" — what the conductor calls out loud. */
export function presetCopyName(preset: Preset, number: number): string {
  return `${preset.name} ${number}`
}

/** `fullHouse-2` → the preset and the number. Null for a preset id or a drawn pattern. */
export function parsePresetCopyId(id: string): PresetCopy | null {
  const split = id.lastIndexOf('-')
  if (split <= 0) return null

  const preset = findPreset(id.slice(0, split))
  if (preset === null) return null

  const suffix = id.slice(split + 1)
  if (!/^\d+$/.test(suffix)) return null

  // A copy starts at 2: "Full House 1" is just Full House, and the preset id already
  // covers it.
  const number = Number(suffix)
  return number >= 2 ? { preset, number } : null
}

/** A copy as a whole condition: the preset's pattern, its own name and its own points. */
export function presetCopy(preset: Preset, number: number, points: number): Condition {
  return {
    id: presetCopyId(preset.id, number),
    name: presetCopyName(preset, number),
    pattern: preset.pattern,
    points,
  }
}

/**
 * A sensible opening split for the six presets, totalling exactly 100. The conductor
 * can change every number; this just means the setup screen starts balanced instead of
 * starting broken.
 */
export const DEFAULT_PRESET_POINTS: Record<string, number> = {
  earlyFive: 10,
  topLine: 15,
  middleLine: 15,
  bottomLine: 15,
  corners: 10,
  fullHouse: 35,
}

/** All six presets as conditions, with the default split applied. */
export function defaultConditions(): Condition[] {
  return PRESETS.map((preset) => ({
    id: preset.id,
    name: preset.name,
    pattern: preset.pattern,
    points: DEFAULT_PRESET_POINTS[preset.id] ?? 0,
  }))
}

// --- Points --------------------------------------------------------------------
//
// Points are a share of 100 and nothing else. 100 because it reads directly as a
// percentage of whatever the humans pooled physically, outside the app — "Full House
// is 40" is instantly "40% of the pot" with no arithmetic. There is no money in this
// app and there never will be; see CLAUDE.md.

export const TOTAL_POINTS = 100

/** Sum of the points assigned so far. The setup screen shows this live. */
export function pointsTotal(conditions: readonly { points: number }[]): number {
  return conditions.reduce((sum, condition) => sum + condition.points, 0)
}

/**
 * Why the game can't start yet, as a sentence to show the conductor — or null when the
 * split is valid. One function so the setup screen and any future validation agree.
 */
export function pointsProblem(conditions: readonly Condition[]): string | null {
  if (conditions.length === 0) return 'Pick at least one winning condition.'

  for (const condition of conditions) {
    if (!Number.isInteger(condition.points) || condition.points < 1) {
      return `${condition.name} needs at least 1 point.`
    }
  }

  const total = pointsTotal(conditions)
  if (total > TOTAL_POINTS) return `${total} points assigned — ${total - TOTAL_POINTS} too many.`
  if (total < TOTAL_POINTS) return `${total} points assigned — ${TOTAL_POINTS - total} still to give out.`
  return null
}

// --- Packing -------------------------------------------------------------------
//
// A pattern is 15 cells, so the shape fits in a 15-bit integer: bit c is set when
// logical cell c is part of the pattern. `required` travels alongside it. This is the
// form the room code and the QR config blob both store.

/** Pattern shape as a 15-bit integer, bit c set when cell c is in the pattern. */
export function patternToMask(pattern: Pattern): number {
  return pattern.cells.reduce((mask, cell) => mask | (1 << cell), 0)
}

/** Rebuild a pattern from its mask. `required` defaults to "all of them". */
export function patternFromMask(mask: number, required?: number): Pattern {
  const cells: LogicalCell[] = []
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if ((mask & (1 << cell)) !== 0) cells.push(cell)
  }
  return makePattern(cells, required)
}
