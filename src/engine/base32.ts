// Crockford base32, shared by everything a human has to read out loud or type in.
//
// Why not plain base36: a conductor reads a room code off a phone screen, across a
// noisy room, to someone squinting at their own phone. Base36 contains both O and 0,
// and both I and 1. Mistype one and you don't get an error — you get a DIFFERENT but
// perfectly valid value, which silently produces the wrong ticket. This alphabet omits
// I, L, O and U entirely, and decoding folds the confusable characters back onto their
// twins, so "K3P0Z" and "K3POZ" are the same value instead of two different ones.
//
// (U is dropped by the original spec to avoid accidental profanity. Keeping the
// alphabet identical to a published standard is worth more than one extra symbol.)

export const BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Bits carried by one base32 character. */
export const BASE32_BITS = 5

/**
 * One character to its value, folding look-alikes: O -> 0, I and L -> 1.
 * Returns null for anything that isn't a base32 digit at all.
 */
export function base32Digit(rawChar: string): number | null {
  const char =
    rawChar === 'O' ? '0' : rawChar === 'I' || rawChar === 'L' ? '1' : rawChar
  const digit = BASE32_ALPHABET.indexOf(char)
  return digit === -1 ? null : digit
}

/**
 * Encode a non-negative integer.
 *
 * @param minLength pad with leading '0' up to this many characters. Leading zeros do
 *                  not change the decoded value, so padding is purely cosmetic — but
 *                  it lets a format like the room code use a FIXED-WIDTH seed, which
 *                  is what makes "seed then rules" splittable without a separator.
 */
export function encodeBase32(value: number, minLength = 1): string {
  let remaining = Math.floor(value)
  let out = ''
  while (remaining > 0) {
    out = BASE32_ALPHABET[remaining % 32] + out
    remaining = Math.floor(remaining / 32)
  }
  return out.padStart(minLength, '0')
}

/** Decode a whole string to a number. Returns null on any character that isn't valid. */
export function decodeBase32(text: string): number | null {
  if (text.length === 0) return null
  let value = 0
  for (const rawChar of text) {
    const digit = base32Digit(rawChar)
    if (digit === null) return null
    value = value * 32 + digit
  }
  return value
}
