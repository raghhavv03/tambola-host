// The end of the game: who won what, and what share of the 100 points each seat took.
//
// Points and nothing else. There is no amount, no currency and no pot anywhere in this
// app — what the room pooled physically, and how they split it by these percentages,
// happens between humans afterwards (PRD.md §8).
//
// Two ways off this phone, because this is the screen whose contents decide how the pot
// gets split and everything behind it is one localStorage record on one device: paper
// (ResultsSheet, the same mechanism the ticket sheet already uses) and plain text on the
// clipboard (results.ts). Both are conductor-side and strictly post-game — they read the
// ledger out, they don't send it anywhere.

import { useState } from 'react'
import type { RoomConfig } from '../engine/room'
import { seatLabel, seatLabelInline, type SeatNames } from './room'
import { isOpen, seatScores, type StoredGame } from './game'
import { resultsText } from './results'
import { ResultsSheet } from './ResultsSheet'

interface ResultsScreenProps {
  config: RoomConfig
  /**
   * The conductor's private labels for seats. This screen is what gets read out at the
   * end of the night, so it is the one that most wants them: "Priya · seat 04 — 35 pts"
   * settles a split, "seat 04 — 35 pts" starts an argument about who seat 04 was.
   */
  seatNames: SeatNames
  game: StoredGame
  /** Back to calling — the conductor ended it early, or by accident. */
  onResume: () => void
  /** Same tickets, fresh draw order and an empty ledger. */
  onPlayAgain: () => void
}

export function ResultsScreen({
  config,
  seatNames,
  game,
  onResume,
  onPlayAgain,
}: ResultsScreenProps) {
  const scores = seatScores(config, game.rulings)
  const unclaimed = config.conditions.filter((c) => isOpen(game.rulings, c.id))

  const [printing, setPrinting] = useState(false)
  const [confirmingPlayAgain, setConfirmingPlayAgain] = useState(false)
  // 'failed' covers a browser that won't hand over the clipboard at all (an insecure
  // origin, a permission the conductor declined). The text is shown to be selected by
  // hand rather than the action just doing nothing.
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const asText = resultsText(config, seatNames, game)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(asText)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  if (printing) {
    // ResultsSheet opens the print dialog as it mounts and calls back when it closes.
    return (
      <ResultsSheet
        config={config}
        seatNames={seatNames}
        game={game}
        onDone={() => setPrinting(false)}
      />
    )
  }

  return (
    <div className="stack">
      <section className="stack-tight">
        <h2 className="subtitle">Results</h2>
        <p className="muted tabular-nums">
          {game.history.length} numbers called.
        </p>
      </section>

      {scores.length === 0 ? (
        <p className="muted">Nobody claimed anything this game.</p>
      ) : (
        <ul className="stack">
          {scores.map((score) => (
            <li key={score.seat} className="card stack-tight">
              <div className="flex items-baseline justify-between gap-3">
                <span className="subtitle tabular-nums">
                  {seatLabel(score.seat, seatNames)}
                </span>
                <span className="title tabular-nums">{score.points} pts</span>
              </div>
              {/* One row each, with the share rather than the condition's face value:
                  a tied Full House is 18 points to this seat, not 35, and the results
                  screen is what gets read out at the end of the night. */}
              {score.won.length > 0 && (
                <ul className="stack-tight">
                  {score.won.map((win) => (
                    <li key={win.condition.id} className="muted tabular-nums">
                      {win.condition.name} — {win.points} pts
                      {win.sharedWith.length > 0 &&
                        ` · tied with ${win.sharedWith
                          .map((seat) => seatLabelInline(seat, seatNames))
                          .join(', ')}`}
                    </li>
                  ))}
                </ul>
              )}
              {score.bogeys > 0 && (
                <p className="muted is-bogey">
                  {score.bogeys} bogey{score.bogeys === 1 ? '' : 's'}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {unclaimed.length > 0 && (
        <section className="stack-tight">
          <span className="label">Nobody won</span>
          <ul className="card stack-tight">
            {unclaimed.map((condition) => (
              <li key={condition.id} className="flex items-baseline justify-between gap-3">
                <span>{condition.name}</span>
                <span className="muted tabular-nums">{condition.points} pts</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Getting this off the phone comes BEFORE the two buttons that change the game,
          because it is what the room is standing there waiting for: everything above is
          one localStorage record on one device until somebody prints it or pastes it
          somewhere. */}
      <section className="stack">
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => setPrinting(true)}
        >
          Print the results
        </button>
        <button type="button" className="btn btn-secondary btn-block" onClick={handleCopy}>
          Copy the results
        </button>
        {copyState === 'copied' && (
          <p className="muted">Copied. Paste it wherever the room can read it.</p>
        )}
        {copyState === 'failed' && (
          <>
            <p className="muted">
              This browser wouldn't hand over the clipboard. Select the text below and
              copy it by hand.
            </p>
            {/* Not a form control — it is the same text the button would have copied,
                sitting there to be selected. `whitespace-pre-wrap` keeps the indentation
                that separates a seat from the prizes under it. */}
            <p className="muted card whitespace-pre-wrap">{asText}</p>
          </>
        )}
      </section>

      <section className="stack">
        <button type="button" className="btn btn-secondary btn-block" onClick={onResume}>
          Back to the game
        </button>

        {/* Confirmed, like every other destructive action in the app. This one wipes
            every ruling in the game — the whole ledger that decides how the pot gets
            split — and it is the filled button on the screen people are looking at
            while they work that out. Undoing a SINGLE ruling has been confirmed since
            P9; wiping all of them at once was the one exception. */}
        {confirmingPlayAgain ? (
          <div className="card stack-tight">
            <p className="muted">
              Start a new game on these tickets? Everything above goes: every prize, every
              point, every bogey. There is no way back to it. Print or copy the results
              first if anybody still needs them.
            </p>
            <div className="flex gap-2">
              {/* Short labels because the pair sits side by side on a phone: the
                  sentence above already says what each one does. */}
              <button type="button" className="btn" onClick={onPlayAgain}>
                New game
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmingPlayAgain(false)}
              >
                Keep results
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-block"
            onClick={() => setConfirmingPlayAgain(true)}
          >
            Play again with these tickets
          </button>
        )}
        <p className="muted">
          Playing again keeps the same tickets and the same prize split, and starts a new
          draw. Nobody has to be handed anything twice.
        </p>
      </section>
    </div>
  )
}
