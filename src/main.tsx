import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { JOIN_ROUTE, PLAYER_ROUTE, CONDUCT_ROUTE } from './routes'

// Register the precache service worker. It only serves cached static files —
// see src/sw.ts for the airgap invariant it upholds (it never relays a message
// between clients). autoUpdate refreshes the cache on a new deploy with no
// prompt. The helper is a no-op where service workers are unavailable.
registerSW({ immediate: true })

// ---------------------------------------------------------------------------
// Three entry points, not one app with routes inside it.
//
// Home, conductor and player are loaded by SEPARATE dynamic imports, so they
// end up in separate bundles with separate module graphs. The player's chunk
// physically does not contain the caller, the conductor's state, or anything
// that could reach them — that is THE AIRGAP made structural rather than
// merely intended (see CLAUDE.md).
//
// Navigation between them is plain <a href> links, i.e. full page loads. That
// is not laziness: a client-side router would need one module graph shared by
// all three screens, which is exactly what we refuse to have. Page loads are
// instant off the precache anyway.
//
// Do not "simplify" this into a shared component tree with a conditional
// render. The split is the safety property.
// ---------------------------------------------------------------------------

const root = createRoot(document.getElementById('root')!)

function render(node: React.ReactNode) {
  root.render(<StrictMode>{node}</StrictMode>)
}

// Trailing slashes are normalised away so "/join/" and "/join" are one route.
const path = window.location.pathname.replace(/\/+$/, '') || '/'

if (path === PLAYER_ROUTE || path === JOIN_ROUTE) {
  // Both the ticket and the join form live in the player bundle: joining by
  // code means deriving a ticket ID locally, which is player-side work.
  void import('./player/PlayerApp').then(({ PlayerApp }) => {
    render(<PlayerApp path={path} />)
  })
} else if (path === CONDUCT_ROUTE) {
  void import('./conductor/ConductorApp').then(({ ConductorApp }) => {
    render(<ConductorApp />)
  })
} else {
  void import('./home/HomeScreen').then(({ HomeScreen }) => {
    render(<HomeScreen />)
  })
}
