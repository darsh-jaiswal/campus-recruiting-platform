import { randomInt } from "node:crypto";

/**
 * Reference codes.
 *
 * A student's Clerk account proves their email; this code is what they actually
 * hold onto and quote — read aloud over the phone, copied off a screen — so the
 * alphabet excludes everything that gets confused in transit: 0/O, 1/I/L, 5/S,
 * 8/B, 2/Z.
 *
 * Crypto RNG rather than Math.random — the code is not a secret, but it should
 * not be guessable enough to let someone enumerate applicants.
 */
const ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
const LENGTH = 6;

export function generateRefCode(): string {
  let out = "";
  for (let i = 0; i < LENGTH; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `AQ-${out}`;
}

/** ~2.4e8 codes; collisions are rare but possible, so callers retry on conflict. */
export const REF_CODE_SPACE = ALPHABET.length ** LENGTH;
