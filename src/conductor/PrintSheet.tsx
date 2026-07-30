// The paper path. Same tickets, same IDs, same generateSet — just rendered for a
// printer instead of a phone.
//
// This exists because paper still wins in a lot of rooms: no phone, no battery, no
// wifi, grandparents. It's offered, not pushed — the host opens it deliberately.
//
// Layout: A4, 6 tickets per page, one per row, cells 11mm tall so a pen fits. The
// ticket ID is printed on every ticket, which is what makes a paper ticket verifiable
// later: the host types that ID into the verifier and the exact grid comes back.

import { useEffect } from 'react'
import type { IdentifiedTicket } from '../engine/ticketId'
import { TicketFace } from './TicketFace'

const TICKETS_PER_PAGE = 6

interface PrintSheetProps {
  tickets: IdentifiedTicket[]
  /** Called once the print dialog closes, so the host screen can come back. */
  onDone: () => void
}

/** Split the batch into pages of 6. */
function paginate(tickets: IdentifiedTicket[]): IdentifiedTicket[][] {
  const pages: IdentifiedTicket[][] = []
  for (let i = 0; i < tickets.length; i += TICKETS_PER_PAGE) {
    pages.push(tickets.slice(i, i + TICKETS_PER_PAGE))
  }
  return pages
}

export function PrintSheet({ tickets, onDone }: PrintSheetProps) {
  useEffect(() => {
    // Mounting this component IS the print action: it renders, then immediately
    // opens the dialog. 'afterprint' fires whether the host printed or cancelled.
    const finish = () => onDone()
    window.addEventListener('afterprint', finish)
    window.print()
    return () => window.removeEventListener('afterprint', finish)
  }, [onDone])

  return (
    // Hidden on screen, visible on paper. The host never sees this component; they
    // see their browser's print preview.
    <div className="hidden bg-white text-black print:block">
      {paginate(tickets).map((page, pageIndex) => (
        <section
          key={pageIndex}
          // Force a new sheet after each group of 6 (except implicitly the last).
          className="break-after-page"
        >
          {page.map((entry) => (
            <article
              key={entry.id}
              // Never split one ticket across two sheets.
              className="mb-[4mm] break-inside-avoid border border-black p-[2mm]"
            >
              <header className="mb-[1.5mm] flex items-baseline justify-between text-[9pt]">
                <span className="font-semibold tracking-wide">TAMBOLA</span>
                <span className="font-mono tracking-widest">{entry.id}</span>
              </header>
              <TicketFace ticket={entry.ticket} variant="print" />
            </article>
          ))}
        </section>
      ))}
    </div>
  )
}
