// The front door. Two journeys, two doors, nothing else on the screen.
//
// Whoever opens the app is either running a game or playing in one, and those
// are genuinely different apps behind one URL. Making the choice the first
// thing they see is what keeps both journeys simple further in — neither has to
// carry a mode switch.

import { CONDUCT_ROUTE, JOIN_ROUTE } from '../routes'

interface DoorProps {
  href: string
  title: string
  description: string
}

function Door({ href, title, description }: DoorProps) {
  return (
    <a href={href} className="card card-action">
      <span className="subtitle block">{title}</span>
      <span className="muted mt-1 block">{description}</span>
    </a>
  )
}

export function HomeScreen() {
  return (
    <div className="screen stack">
      <header className="stack-tight">
        <h1 className="title">Tambola</h1>
        <p className="muted">
          Run a housie game at a party, or play on your own phone. Numbers are
          called by a person, tickets are marked by hand.
        </p>
      </header>

      <div className="stack">
        <Door
          href={CONDUCT_ROUTE}
          title="Conduct a game"
          description="Set up a room, hand out tickets, call the numbers and check claims."
        />
        <Door
          href={JOIN_ROUTE}
          title="Join a game"
          description="Enter the room code the conductor gave you, or scan their QR code."
        />
      </div>

      <p className="muted">
        No sign-up, no accounts, nothing stored anywhere but this device.
      </p>
    </div>
  )
}
