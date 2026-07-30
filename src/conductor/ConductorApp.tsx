// The conductor's journey. Skeleton only in P0 — setup lands in P2, the live
// game and the claim verifier in P3 (see ROADMAP.md).
//
// Everything the conductor does lives under this bundle: room setup, ticket
// distribution, the draw, and claim verification. The player's bundle can
// never import from here, which is what makes THE AIRGAP structural rather
// than a promise — src/player/airgap.test.ts fails the build if it does.

import { HOME_ROUTE } from '../routes'

export function ConductorApp() {
  return (
    <div className="screen stack">
      <header className="stack-tight">
        <a href={HOME_ROUTE} className="muted">
          ← Home
        </a>
        <h1 className="title">Conduct a game</h1>
      </header>

      <section className="card stack-tight">
        <h2 className="subtitle">Not built yet</h2>
        <p className="muted">
          Room setup, ticket distribution, the number caller and the claim
          verifier arrive in the next passes. This screen exists so the front
          door leads somewhere real.
        </p>
      </section>
    </div>
  )
}
