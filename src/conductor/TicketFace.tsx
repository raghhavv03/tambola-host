// A ticket drawn read-only, for the CONDUCTOR's eyes: on the print sheet and in the
// claim verifier. Not interactive — the only tappable ticket in this app is the
// player's own, on /t.
//
// `calledNumbers` is optional and used exclusively by the verifier, where showing
// which of a ticket's 15 numbers have actually come out is the entire point. It is
// never passed on the player's side; that would be the app doing the matching.

import type { Ticket } from '../engine/ticket'

interface TicketFaceProps {
  ticket: Ticket
  /** Conductor-side only: numbers to show as already called. */
  calledNumbers?: Set<number>
  /** 'screen' = on-screen sizing. 'print' = cells sized for a pen. */
  variant?: 'screen' | 'print'
}

export function TicketFace({
  ticket,
  calledNumbers,
  variant = 'screen',
}: TicketFaceProps) {
  const isPrint = variant === 'print'

  return (
    <div
      className={`grid grid-cols-9 ${isPrint ? 'gap-0' : 'gap-0.5'}`}
      // Printed rows are 11mm tall: enough for an adult to strike a number with a
      // pen without hitting its neighbour. Screen rows just need to be readable.
      style={{
        gridTemplateRows: isPrint ? 'repeat(3, 11mm)' : 'repeat(3, 1.6rem)',
      }}
    >
      {ticket.flatMap((row, rowIndex) =>
        row.map((value, colIndex) => {
          const called = value !== null && calledNumbers?.has(value) === true

          if (isPrint) {
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="flex items-center justify-center border border-black text-base font-semibold tabular-nums"
              >
                {value ?? ''}
              </div>
            )
          }

          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              // A number that has come out is filled black; one that hasn't is
              // outlined. That's the only distinction the verifier needs, and it
              // survives the later visual pass unchanged.
              className={`flex items-center justify-center rounded border text-sm font-semibold tabular-nums ${
                value === null
                  ? 'border-neutral-200 bg-neutral-100'
                  : called
                    ? 'border-black bg-black text-white'
                    : 'border-neutral-400 bg-white text-black'
              }`}
            >
              {value ?? ''}
            </div>
          )
        }),
      )}
    </div>
  )
}
