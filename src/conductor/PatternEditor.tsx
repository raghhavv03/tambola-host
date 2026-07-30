// The custom-condition editor: name a rule, tap the positions that satisfy it.
//
// The grid here is the 3x5 LOGICAL grid — three rows by the five numbers in each row
// — not the 3x9 printed ticket. Every ticket has exactly five numbers per row, but
// which of the nine columns they land in differs ticket to ticket, so a shape drawn on
// the printed grid would be unsatisfiable on some tickets and free on others. On this
// grid "four corners" means the same four numbers on every ticket ever printed. See
// the long comment at the top of engine/patterns.ts.

import { useState } from 'react'
import {
  NUMBERS_PER_ROW,
  ROWS,
  cellAt,
  makePattern,
  type LogicalCell,
  type Pattern,
} from '../engine/patterns'

interface PatternEditorProps {
  /** Called with a normalised pattern. Points are assigned in the list, not here. */
  onAdd: (name: string, pattern: Pattern) => void
  onCancel: () => void
}

export function PatternEditor({ onAdd, onCancel }: PatternEditorProps) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Set<LogicalCell>>(new Set())
  // "How many of the tapped cells must be marked." Held as text so the field can be
  // emptied while typing; read back through makePattern, which clamps it into range.
  const [requiredText, setRequiredText] = useState('')

  const count = selected.size
  const required = requiredText.trim() === '' ? count : Number(requiredText)
  const canAdd = name.trim().length > 0 && count > 0

  function toggle(cell: LogicalCell) {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(cell)) {
        next.delete(cell)
      } else {
        next.add(cell)
      }
      return next
    })
  }

  function handleAdd() {
    if (!canAdd) return
    onAdd(name.trim(), makePattern([...selected], required))
  }

  return (
    <div className="card stack">
      <h3 className="subtitle">New condition</h3>

      <div className="stack-tight">
        <label className="label" htmlFor="condition-name">
          Name
        </label>
        <input
          id="condition-name"
          className="field"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Middle Cross"
          maxLength={24}
        />
      </div>

      <div className="stack-tight">
        <span className="label">Positions</span>
        <p className="muted">
          Three rows, five numbers per row — the positions in a row, not the printed
          columns. Tap the ones this condition needs.
        </p>

        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: ROWS }, (_, row) =>
            Array.from({ length: NUMBERS_PER_ROW }, (_, position) => {
              const cell = cellAt(row, position)
              const on = selected.has(cell)
              return (
                <button
                  key={cell}
                  type="button"
                  onClick={() => toggle(cell)}
                  aria-pressed={on}
                  aria-label={`Row ${row + 1}, number ${position + 1}`}
                  // Filled black when it counts, outlined when it doesn't. Same 44px
                  // floor as every other control.
                  className={`flex min-h-11 items-center justify-center rounded border text-sm font-semibold ${
                    on
                      ? 'border-black bg-black text-white'
                      : 'border-neutral-400 bg-white text-neutral-500'
                  }`}
                >
                  {position + 1}
                </button>
              )
            }),
          )}
        </div>
      </div>

      <div className="stack-tight">
        <label className="label" htmlFor="condition-required">
          Numbers needed
        </label>
        <input
          id="condition-required"
          className="field"
          value={requiredText}
          onChange={(event) => setRequiredText(event.target.value)}
          placeholder={String(count)}
          inputMode="numeric"
          pattern="[0-9]*"
        />
        <p className="muted">
          {count === 0
            ? 'Tap some positions first.'
            : `${Math.max(1, Math.min(count, Math.floor(required) || count))} of the ${count} tapped ` +
              'positions must be marked. Leave this blank to need all of them.'}
        </p>
      </div>

      <div className="flex gap-2">
        <button type="button" className="btn" onClick={handleAdd} disabled={!canAdd}>
          Add condition
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
