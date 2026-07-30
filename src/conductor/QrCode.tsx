// A QR code, drawn as inline SVG.
//
// Generated locally with `qrcode-generator` (MIT, zero dependencies, no network) —
// the whole app stays offline-capable, which matters because the host's venue wifi
// usually doesn't. Inline SVG rather than a canvas or an image so it stays crisp on
// a projector, scales to any size, and prints at printer resolution.

import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

interface QrCodeProps {
  /** The text to encode — here, always a full ticket URL. */
  value: string
  /** Rendered size in CSS pixels (square). */
  size?: number
  className?: string
}

/**
 * Turn the QR module grid into one SVG path. One path instead of hundreds of <rect>
 * elements keeps the DOM small when a host screen shows 24 codes at once.
 */
function modulesToPath(qr: ReturnType<typeof qrcode>): string {
  const count = qr.getModuleCount()
  const parts: string[] = []
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      // "move to this cell, draw a 1x1 square" — coordinates are in module units,
      // and the viewBox scales them to whatever pixel size we render at.
      if (qr.isDark(row, col)) parts.push(`M${col},${row}h1v1h-1z`)
    }
  }
  return parts.join('')
}

export function QrCode({ value, size = 128, className }: QrCodeProps) {
  const { path, extent } = useMemo(() => {
    // Type number 0 = pick the smallest QR version that fits the data.
    // Level 'M' = ~15% error correction: enough to survive a phone camera at an
    // angle in bad light, without inflating the code so much it gets hard to scan.
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()

    const count = qr.getModuleCount()
    const quiet = 2 // quiet-zone modules on each side; scanners need the margin
    return { path: modulesToPath(qr), extent: count + quiet * 2 }
  }, [value])

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`-2 -2 ${extent} ${extent}`}
      // Keeps the modules as hard-edged squares instead of blurring them.
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code linking to this ticket"
    >
      {/* The light background must be part of the SVG: a QR on a transparent
          background over a dark page is unscannable. */}
      <rect x="-2" y="-2" width={extent} height={extent} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  )
}
