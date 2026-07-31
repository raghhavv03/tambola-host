// What the room is playing for, and how the 100 points are split.
//
// Presets toggle on and off; custom conditions are drawn on the 3x5 logical grid by
// PatternEditor. Both end up as the same `Condition` shape, so the verifier (P3) has
// one code path for all of them.
//
// The running total is the gate on starting a game: points are a share of 100 and
// must add up to exactly that. 100 because it reads directly as a percentage of
// whatever the humans pooled physically, outside the app. There is no money in here
// and there never will be — see CLAUDE.md.

import { useState } from 'react'
import {
  DEFAULT_PRESET_POINTS,
  PRESETS,
  TOTAL_POINTS,
  isPresetId,
  pointsProblem,
  pointsTotal,
  type Condition,
  type Pattern,
} from '../engine/patterns'
import { PatternEditor } from './PatternEditor'

interface ConditionsEditorProps {
  conditions: Condition[]
  onChange: (conditions: Condition[]) => void
}

/** Points a brand-new custom condition starts on. The conductor rebalances from there. */
const NEW_CUSTOM_POINTS = 10

/**
 * Presets first, in PRESETS order, then custom conditions in the order they were
 * added. Toggling a preset off and on again should put it back where it was rather
 * than at the bottom of the list.
 */
function inCanonicalOrder(conditions: Condition[]): Condition[] {
  const presets = PRESETS.map((preset) =>
    conditions.find((condition) => condition.id === preset.id),
  ).filter((condition): condition is Condition => condition !== undefined)
  const custom = conditions.filter((condition) => !isPresetId(condition.id))
  return [...presets, ...custom]
}

/** Next free id for a custom condition: c1, c2, c3… unique within this room. */
function nextCustomId(conditions: Condition[]): string {
  const used = conditions
    .map((condition) => /^c(\d+)$/.exec(condition.id))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]))
  return `c${Math.max(0, ...used) + 1}`
}

/** "4 of 4 positions" / "any 5 of 15 positions" — enough to recognise a rule by. */
function describePattern(pattern: Pattern): string {
  const cells = `${pattern.cells.length} position${pattern.cells.length === 1 ? '' : 's'}`
  return pattern.required === pattern.cells.length
    ? `All ${cells}`
    : `Any ${pattern.required} of ${cells}`
}

/** The points field: narrow, numeric, and the same on every row. */
function PointsField({
  id,
  points,
  disabled,
  onChange,
}: {
  id: string
  points: number
  disabled?: boolean
  onChange: (points: number) => void
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <input
        id={id}
        className="field w-16 text-right tabular-nums"
        value={points === 0 ? '' : String(points)}
        // Held as a number, not text: an empty field reads as 0, which the running
        // total then reports as "still to give out" rather than silently accepting.
        onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, '')) || 0)}
        disabled={disabled}
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label="Points"
        placeholder="0"
      />
      <span className="muted">pts</span>
    </span>
  )
}

export function ConditionsEditor({ conditions, onChange }: ConditionsEditorProps) {
  const [adding, setAdding] = useState(false)

  const total = pointsTotal(conditions)
  const problem = pointsProblem(conditions)
  const custom = conditions.filter((condition) => !isPresetId(condition.id))

  function setPoints(id: string, points: number) {
    onChange(
      conditions.map((condition) =>
        condition.id === id ? { ...condition, points } : condition,
      ),
    )
  }

  function togglePreset(id: string, on: boolean) {
    if (!on) {
      onChange(conditions.filter((condition) => condition.id !== id))
      return
    }
    const preset = PRESETS.find((entry) => entry.id === id)
    if (preset === undefined) return
    onChange(
      inCanonicalOrder([
        ...conditions,
        {
          id: preset.id,
          name: preset.name,
          pattern: preset.pattern,
          points: DEFAULT_PRESET_POINTS[preset.id] ?? 0,
        },
      ]),
    )
  }

  function addCustom(name: string, pattern: Pattern) {
    onChange([
      ...conditions,
      { id: nextCustomId(conditions), name, pattern, points: NEW_CUSTOM_POINTS },
    ])
    setAdding(false)
  }

  return (
    <section className="stack">
      <div className="stack-tight">
        <h2 className="subtitle">Winning conditions</h2>
        <p className="muted">
          Pick what this room plays for and split 100 points between them. Points are a
          share of the pot the room agreed on between themselves — the app only counts.
        </p>
      </div>

      <div className="card stack-tight">
        {PRESETS.map((preset) => {
          const condition = conditions.find((entry) => entry.id === preset.id)
          const checkboxId = `preset-${preset.id}`
          return (
            <div key={preset.id} className="flex min-h-11 items-center gap-3">
              <input
                id={checkboxId}
                type="checkbox"
                className="size-5 shrink-0 accent-black"
                checked={condition !== undefined}
                onChange={(event) => togglePreset(preset.id, event.target.checked)}
              />
              <label htmlFor={checkboxId} className="flex-1">
                {preset.name}
              </label>
              <PointsField
                id={`points-${preset.id}`}
                points={condition?.points ?? 0}
                disabled={condition === undefined}
                onChange={(points) => setPoints(preset.id, points)}
              />
            </div>
          )
        })}
      </div>

      {custom.length > 0 && (
        <div className="card stack-tight">
          {custom.map((condition) => (
            <div key={condition.id} className="flex min-h-11 items-center gap-3">
              <span className="flex-1">
                {condition.name}
                <span className="muted block">{describePattern(condition.pattern)}</span>
              </span>
              <PointsField
                id={`points-${condition.id}`}
                points={condition.points}
                onChange={(points) => setPoints(condition.id, points)}
              />
              <button
                type="button"
                className="btn-inline"
                onClick={() =>
                  onChange(conditions.filter((entry) => entry.id !== condition.id))
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <PatternEditor onAdd={addCustom} onCancel={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => setAdding(true)}
        >
          Add a custom condition
        </button>
      )}

      {custom.length > 0 && (
        <p className="muted">
          Custom conditions travel by QR code only. Players who join by typing the room
          code will see the preset conditions and their points, and nothing about these
          — read them out, or hand those players a QR.
        </p>
      )}

      <div className="card flex items-baseline justify-between">
        <span className="label">Points assigned</span>
        <span
          className={`subtitle tabular-nums ${problem === null ? 'is-valid' : ''}`}
        >
          {total} / {TOTAL_POINTS}
        </span>
      </div>

      {problem !== null && <p className="muted is-bogey">{problem}</p>}
    </section>
  )
}
