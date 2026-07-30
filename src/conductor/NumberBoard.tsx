// The board of all 90 numbers, with the called ones filled in.
//
// This is the CONDUCTOR's screen and it is correct: a physical game has exactly this
// board on the table, and the caller glances at it to answer "did we call 47 yet?".
// The same board next to a player's own ticket would be the app doing the matching for
// them, which is why nothing like this exists in the player bundle — see THE AIRGAP.

const ALL_NUMBERS = Array.from({ length: 90 }, (_, i) => i + 1)

interface NumberBoardProps {
  called: Set<number>
  /** The number just drawn, outlined so the conductor can find it at a glance. */
  latest: number | null
}

export function NumberBoard({ called, latest }: NumberBoardProps) {
  return (
    // Ten per row, so a row is a decade and the eye can jump straight to a number.
    <div className="grid grid-cols-10 gap-1">
      {ALL_NUMBERS.map((number) => {
        const isCalled = called.has(number)
        return (
          <span
            key={number}
            className={[
              'flex aspect-square items-center justify-center rounded border text-sm tabular-nums',
              isCalled ? 'border-black bg-black font-semibold text-white' : 'border-neutral-300 text-neutral-400',
              number === latest ? 'outline-2 outline-offset-2 outline-black' : '',
            ].join(' ')}
          >
            {number}
          </span>
        )
      })}
    </div>
  )
}
