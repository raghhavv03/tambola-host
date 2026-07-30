// THE AIRGAP, enforced mechanically.
//
// A comment saying "/t must never talk to the caller" is a wish. This test is the
// enforcement: it walks the player route's real import graph on disk and fails the
// build if a single reachable module could obtain caller state or open a network
// connection of any kind.
//
// It is deliberately a STATIC test rather than a rendered one. Rendering /t and
// asserting fetch wasn't called only proves it didn't happen on that render, with
// that ticket, down that code path. Walking the import graph proves the capability
// isn't in the bundle at all — there is no branch, no timer, no event handler that
// could ever reach the caller, because the code isn't there to reach.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Matches both `import x from './y'` / `export * from './y'` and `import('./y')`.
// A dynamic import is just as much an escape hatch as a static one, so both count.
const IMPORT_PATTERN = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g

// Resolve an import specifier the way the bundler would, for the local-file cases we
// care about. Bare specifiers (react, motion, …) return null — they're dependencies,
// not app modules, and are checked separately by the forbidden-API scan.
function resolveLocal(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null
  const base = resolve(dirname(fromFile), specifier)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ]
  return candidates.find((path) => existsSync(path) && path.endsWith('x')) ??
    candidates.find((path) => existsSync(path) && path.endsWith('.ts')) ??
    null
}

/** Every local module reachable from `entry`, including `entry` itself. */
function importGraph(entry: string): Map<string, string> {
  const files = new Map<string, string>() // absolute path -> source text
  const queue = [entry]

  while (queue.length > 0) {
    const file = queue.pop()!
    if (files.has(file)) continue
    const source = readFileSync(file, 'utf8')
    files.set(file, source)

    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const resolved = resolveLocal(file, match[1])
      if (resolved !== null) queue.push(resolved)
    }
  }
  return files
}

const PLAYER_ENTRY = resolve(SRC, 'player/PlayerApp.tsx')
const CONDUCTOR_ENTRY = resolve(SRC, 'conductor/ConductorApp.tsx')

// Anything that is, or could hand over, the state of the game in progress.
const FORBIDDEN_MODULES = [
  'engine/caller.ts',
  'conductor/', // the conductor's screens, stores and storage
  'store/', // no shared store of any kind, present or future
  'home/', // the front door renders in its own bundle
  'ui/', // shared components are a shared graph; a player one goes in src/player/
]

// Every way a browser can open a channel to somewhere else.
const FORBIDDEN_APIS = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /EventSource/,
  /sendBeacon/,
  /BroadcastChannel/,
  /SharedWorker/,
  /serviceWorker/,
  /postMessage/,
  /\bWebRTC|RTCPeerConnection/,
]

describe('THE AIRGAP: the player route cannot reach the caller', () => {
  const playerFiles = importGraph(PLAYER_ENTRY)

  it('reaches only the pure ticket engine and its own files', () => {
    // Spelled out as an allowlist rather than a denylist: a new module added to the
    // player's graph fails this test until someone consciously permits it here.
    const reachable = [...playerFiles.keys()]
      .map((path) => path.slice(SRC.length + 1))
      .sort()

    expect(reachable).toEqual([
      'engine/rng.ts',
      'engine/ticket.ts',
      'engine/ticketId.ts',
      'player/JoinForm.tsx',
      'player/PlayerApp.tsx',
      'player/TicketCell.tsx',
      'player/marks.ts',
      'routes.ts',
    ])
  })

  it('imports nothing from the conductor, the caller, or shared components', () => {
    for (const path of playerFiles.keys()) {
      const relative = path.slice(SRC.length + 1)
      for (const forbidden of FORBIDDEN_MODULES) {
        expect(
          relative.includes(forbidden),
          `${relative} is reachable from /t but is conductor-only`,
        ).toBe(false)
      }
    }
  })

  it('contains no network or cross-context API anywhere in its graph', () => {
    for (const [path, source] of playerFiles) {
      for (const api of FORBIDDEN_APIS) {
        expect(
          api.test(source),
          `${path.slice(SRC.length + 1)} matches ${api} — /t must issue no network requests`,
        ).toBe(false)
      }
    }
  })

  it('never mentions the called-numbers vocabulary', () => {
    // A cheap tripwire for the OTHER failure mode: not fetching the called list, but
    // being handed it and then hinting with it. If any of these words ever appear in
    // the player's graph, someone is building a cross-reference.
    const banned = [/\bcalled\b/, /\bcalledNumbers\b/, /\bverifyClaim\b/, /\bdrawn\b/]
    for (const [path, source] of playerFiles) {
      // Skip the shared pure engine: ticket.ts legitimately defines verifyClaim for
      // the CONDUCTOR's verifier. What matters is that no player file calls it.
      if (path.includes('/engine/')) continue
      for (const word of banned) {
        expect(
          word.test(source.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')), // ignore comments
          `${path.slice(SRC.length + 1)} mentions ${word} — /t must not know what was called`,
        ).toBe(false)
      }
    }
  })
})

describe('THE AIRGAP: the conductor cannot reach into the player', () => {
  const conductorFiles = importGraph(CONDUCTOR_ENTRY)

  it('never touches the player-marks storage key', () => {
    // The player's marks live in localStorage, which is same-origin and therefore
    // technically readable by the conductor's screen. This test is what makes that
    // safe: nothing on the conductor side may name that key prefix, so marks only
    // ever flow player -> player.
    for (const [path, source] of conductorFiles) {
      expect(
        source.includes('tambola:marks:'),
        `${path.slice(SRC.length + 1)} touches the player's mark storage`,
      ).toBe(false)
    }
  })

  it('does not statically import the player screen', () => {
    // The screens are separate bundles loaded by separate dynamic imports in
    // main.tsx. If the conductor ever imports PlayerApp directly, they share a
    // graph again.
    for (const path of conductorFiles.keys()) {
      expect(path.includes('/player/')).toBe(false)
    }
  })

  it('ships a precache-only service worker that relays nothing between clients', () => {
    // The real PWA airgap invariant is NOT "which file calls register()" — it's
    // that the service worker (which controls BOTH the conductor tab and /t) can never
    // forward a message from one client to another. If it could, that is a channel
    // from the caller into the player's ticket. So the SW source must contain no
    // client enumeration and no postMessage to a client.
    const swPath = resolve(SRC, 'sw.ts')
    const sw = readFileSync(swPath, 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '') // strip comments
    for (const relay of [/clients\s*\.\s*matchAll/, /clients\s*\.\s*get\b/, /\.postMessage\s*\(/]) {
      expect(
        relay.test(sw),
        `src/sw.ts matches ${relay} — the service worker must not relay between clients`,
      ).toBe(false)
    }
  })
})
