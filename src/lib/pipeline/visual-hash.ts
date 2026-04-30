/**
 * Phase 8: perceptual hash of a viewport screenshot.
 *
 * Used as a third diff signal alongside (a) text content hash and (b)
 * block-level diff. When all three say "unchanged", we can safely skip
 * the snapshot. Catches the SPA "hydration race" case where text bytes
 * oscillate between the empty shell and the populated page on each poll
 * but the rendered pixels look identical.
 *
 * Algorithm: 8×8 average-hash (aHash). Cheap, fast, fits in 64 bits hex.
 * Two screenshots are "visually identical" when the Hamming distance of
 * their hashes is ≤ 5 bits.
 *
 * `sharp` is loaded dynamically — if it's not installed the hash returns
 * NULL and the rest of the pipeline proceeds without the visual signal.
 */
import { getLogger } from "@/lib/logger";

const log = getLogger("pipeline.visual-hash");

const SIDE = 8;

/** Compute aHash of an RGBA pixel buffer. Returns 64-bit hex (16 chars). */
function aHashFromGrayscale(values: Uint8Array): string {
  if (values.length !== SIDE * SIDE) {
    throw new Error(`expected ${SIDE * SIDE} pixels, got ${values.length}`);
  }
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  const avg = sum / values.length;

  let hex = "";
  for (let nibble = 0; nibble < 16; nibble++) {
    let v = 0;
    for (let bit = 0; bit < 4; bit++) {
      const idx = nibble * 4 + bit;
      if (values[idx] >= avg) v |= 1 << (3 - bit);
    }
    hex += v.toString(16);
  }
  return hex;
}

/** Resize a screenshot PNG to 8×8 grayscale and aHash it. NULL if sharp is
 *  unavailable or the image can't be decoded. */
export async function visualHashFromPng(png: Buffer): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sharp: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sharp = (await import(/* webpackIgnore: true */ "sharp" as any).catch(() => null)) as any;
  } catch {
    sharp = null;
  }
  if (!sharp?.default) {
    log.debug("sharp not installed; skipping visual hash");
    return null;
  }
  try {
    const { data } = await sharp
      .default(png)
      .resize(SIDE, SIDE, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return aHashFromGrayscale(new Uint8Array(data.buffer, data.byteOffset, SIDE * SIDE));
  } catch (err) {
    log.warn({ err }, "visual hash compute failed");
    return null;
  }
}

/** Hamming distance between two 64-bit hex strings. NULL on shape mismatch. */
export function hammingHex(a: string, b: string): number | null {
  if (a.length !== b.length) return null;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    // Brian Kernighan popcount on a single nibble.
    let v = xor;
    while (v) {
      v &= v - 1;
      dist++;
    }
  }
  return dist;
}

/** Threshold tuned from the literature: ≤5 bits ≈ same image perceptually. */
export const VISUAL_IDENTICAL_BITS = 5;

export function visuallyIdentical(prev: string | null, curr: string | null): boolean {
  if (!prev || !curr) return false;
  const d = hammingHex(prev, curr);
  return d !== null && d <= VISUAL_IDENTICAL_BITS;
}
