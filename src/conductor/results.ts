// The ledger as plain text: what the results screen says, in something that can leave
// the phone.
//
// Everything the conductor's ledger holds lives in one localStorage record on one
// device. That is fine while the game is running and useless the moment the party is
// over — a flat battery, a cleared browser or simply somebody standing on the other
// side of the room and the night's results are gone. This is the copy-to-clipboard half
// of the way out; ResultsSheet.tsx is the paper half, and both read the same
// `seatScores` the screen does so the three can never disagree.
//
// Points and nothing else, same as everywhere: no amount, no currency, no pot. What the
// room pooled physically and how they split it by these percentages happens between
// humans afterwards (PRD.md §8).

import type { RoomConfig } from '../engine/room'
import { isOpen, seatScores, type StoredGame } from './game'
import { seatLabel, seatLabelInline, type SeatNames } from './room'

/**
 * The whole result, formatted for a message app.
 *
 * Written to be readable as it is — no markdown, no table alignment, nothing that
 * depends on a monospace font, because this gets pasted into WhatsApp far more often
 * than into anything else.
 */
export function resultsText(
  config: RoomConfig,
  seatNames: SeatNames,
  game: StoredGame,
): string {
  const scores = seatScores(config, game.rulings)
  const unclaimed = config.conditions.filter((c) => isOpen(game.rulings, c.id))

  const lines: string[] = []
  lines.push(config.name.trim().length === 0 ? 'Tambola' : `Tambola — ${config.name}`)
  lines.push(`${game.history.length} numbers called`)

  lines.push('')
  if (scores.length === 0) {
    lines.push('Nobody claimed anything this game.')
  } else {
    for (const score of scores) {
      lines.push(`${seatLabel(score.seat, seatNames)} — ${score.points} pts`)
      for (const win of score.won) {
        // Two spaces, not a tab: a tab is rendered at a different width by every app
        // this is likely to be pasted into.
        const shared =
          win.sharedWith.length === 0
            ? ''
            : ` · tied with ${win.sharedWith
                .map((seat) => seatLabelInline(seat, seatNames))
                .join(', ')}`
        lines.push(`  ${win.condition.name} — ${win.points} pts${shared}`)
      }
      if (score.bogeys > 0) {
        lines.push(`  ${score.bogeys} bogey${score.bogeys === 1 ? '' : 's'}`)
      }
      lines.push('')
    }
    // Every seat block ends with a blank line; drop the last one so the section that
    // follows doesn't start with two.
    lines.pop()
  }

  if (unclaimed.length > 0) {
    lines.push('')
    lines.push('Nobody won')
    for (const condition of unclaimed) {
      lines.push(`  ${condition.name} — ${condition.points} pts`)
    }
  }

  lines.push('')
  lines.push("Points are out of 100 — each seat's share of whatever the room pooled.")

  return lines.join('\n')
}
