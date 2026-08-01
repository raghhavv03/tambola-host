/// <reference lib="webworker" />
//
// THE AIRGAP — SERVICE WORKER INVARIANT.
//
// This worker exists for ONE reason: serve the app's own static files from cache
// so the host (and a scanned /t ticket) work offline. That is the same set of
// files the browser would fetch anyway — no game state passes through here.
//
// It MUST NEVER relay messages between clients. Specifically: no clients.matchAll(),
// no clients.get(), and no postMessage() to any client. The service worker controls
// both the host tab and the /t tab; forwarding a message from one to the other would
// be a channel from the caller into the player's ticket — exactly what THE AIRGAP
// forbids. Registration lives in a file (main.tsx); the guarantee lives HERE, in the
// absence of any relay code. src/player/airgap.test.ts asserts that absence.
//
// Precache only. Nothing else belongs in this file.

import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

precacheAndRoute(self.__WB_MANIFEST)

// Navigation fallback: every page request is answered with the precached
// index.html.
//
// None of this app's routes (/t, /join, /conduct) has a file behind it — they
// are all the same index.html, and online it is the host that says so
// (vercel.json rewrites anything unknown to /index.html). Offline there is no
// host to do that, and precacheAndRoute alone only matches URLs that are
// actually IN the manifest, so a scanned /t#... QR opened with no signal would
// get a network error. This route is the offline half of that rewrite: same
// rule, applied in the service worker.
//
// It is still precache-only — it serves a file we already cached, it fetches
// nothing and it relays nothing between clients, so the invariant above holds.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))
