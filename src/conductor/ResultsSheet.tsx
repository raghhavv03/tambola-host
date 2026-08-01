// The results on paper: the same ledger the results screen shows, on something that
// isn't the conductor's phone.
//
// Same mechanism as PrintSheet.tsx — mounting this component IS the print action, and
// it is hidden on screen and visible on paper. It exists for the same reason: at the
// end of a party the room ends up crowded around one phone to see who won what, and
// the one record of it is a localStorage key on a device that can run out of battery.
//
// It reads `seatScores` exactly like ResultsScreen does, so the paper and the screen
// cannot say different things about how the pot gets split.

import { useEffect } from 'react'
import type { RoomConfig } from '../engine/room'
import { isOpen, seatScores, type StoredGame } from './game'
import { seatLabel, seatLabelInline, type SeatNames } from './room'

interface ResultsSheetProps {
  config: RoomConfig
  seatNames: SeatNames
  game: StoredGame
  /** Called once the print dialog closes, so the results screen can come back. */
  onDone: () => void
}

export function ResultsSheet({ config, seatNames, game, onDone }: ResultsSheetProps) {
  useEffect(() => {
    // 'afterprint' fires whether the conductor printed or cancelled.
    const finish = () => onDone()
    window.addEventListener('afterprint', finish)
    window.print()
    return () => window.removeEventListener('afterprint', finish)
  }, [onDone])

  const scores = seatScores(config, game.rulings)
  const unclaimed = config.conditions.filter((c) => isOpen(game.rulings, c.id))

  return (
    // Hidden on screen, visible on paper. The conductor never sees this component;
    // they see their browser's print preview.
    <div className="hidden bg-white text-black print:block">
      <header className="mb-[4mm] border-b border-black pb-[2mm]">
        <h1 className="text-[14pt] font-bold">
          {config.name.trim().length === 0 ? 'Tambola' : config.name}
        </h1>
        <p className="text-[10pt]">{game.history.length} numbers called</p>
      </header>

      {scores.length === 0 ? (
        <p className="text-[10pt]">Nobody claimed anything this game.</p>
      ) : (
        <ul>
          {scores.map((score) => (
            // Never split one seat's block across two sheets — a name on one page and
            // its points on the next is exactly the argument this sheet exists to avoid.
            <li key={score.seat} className="mb-[3mm] break-inside-avoid">
              <div className="flex items-baseline justify-between text-[11pt] font-semibold">
                <span>{seatLabel(score.seat, seatNames)}</span>
                <span>{score.points} pts</span>
              </div>
              <ul className="text-[10pt]">
                {score.won.map((win) => (
                  <li
                    key={win.condition.id}
                    className="flex items-baseline justify-between pl-[4mm]"
                  >
                    <span>
                      {win.condition.name}
                      {win.sharedWith.length > 0 &&
                        ` · tied with ${win.sharedWith
                          .map((seat) => seatLabelInline(seat, seatNames))
                          .join(', ')}`}
                    </span>
                    <span>{win.points} pts</span>
                  </li>
                ))}
                {score.bogeys > 0 && (
                  <li className="pl-[4mm]">
                    {score.bogeys} bogey{score.bogeys === 1 ? '' : 's'}
                  </li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {unclaimed.length > 0 && (
        <section className="mt-[4mm] break-inside-avoid">
          <h2 className="text-[11pt] font-semibold">Nobody won</h2>
          <ul className="text-[10pt]">
            {unclaimed.map((condition) => (
              <li
                key={condition.id}
                className="flex items-baseline justify-between pl-[4mm]"
              >
                <span>{condition.name}</span>
                <span>{condition.points} pts</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-[4mm] text-[9pt]">
        Points are out of 100 — each seat's share of whatever the room pooled.
      </p>
    </div>
  )
}
