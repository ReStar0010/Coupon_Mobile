/**
 * Shared wheel geometry for the spinner.
 *
 * Single source of truth for "where does multiplier X sit under the needle,
 * and how far must the wheel turn to land it there". Used by both the solo
 * timeline (`useSpinLogic`) and the co-op animation driver
 * (`coop/useCoopSpinAnimation`) so the two flows land identically.
 */

export interface SectorMath {
  /** Sector-center angle in degrees, measured the same way WheelDial draws. */
  centerDeg: number;
  color: string;
}

/**
 * Compute the on-wheel position + colour of `multiplier` within `table`.
 *
 * `table` must already be filtered to the sectors actually drawn for the
 * current floor (i.e. `MULTS.filter(m => m.v >= floor)`), so the weights here
 * match WheelDial's `buildRanges`.
 */
export function computeSectorMath(
  table: ReadonlyArray<{ v: number; color: string }>,
  multiplier: number,
): SectorMath {
  const weights = table.map((m) => 1 / (m.v + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  // WheelDial draws sectors starting at -90° (top). Accumulate from -90°
  // so the target degree matches the visual position under the top needle.
  let acc = -90;
  for (let i = 0; i < table.length; i++) {
    const w = (weights[i] / total) * 360;
    if (table[i].v === multiplier) {
      return { centerDeg: (((acc + w / 2) % 360) + 360) % 360, color: table[i].color };
    }
    acc += w;
  }
  return { centerDeg: 0, color: table[0]?.color ?? '#2E2E2E' };
}

/**
 * Absolute rotation (degrees) the wheel must reach so `sectorCenterDeg` ends up
 * under the needle, continuing forward from `currentSpin`.
 *
 * `minRotations` is the number of extra full turns baked in before the landing
 * adjustment — solo spins up from rest (7), co-op is already free-spinning so a
 * smaller value reads as a decel rather than a fresh launch. A small random
 * jitter keeps the resting position from looking mechanically exact.
 */
export function computeLandingSpin(
  currentSpin: number,
  sectorCenterDeg: number,
  minRotations = 7,
): number {
  const currentMod = ((currentSpin % 360) + 360) % 360;
  const sectorPos = (sectorCenterDeg + currentMod) % 360;
  // The needle sits at -90° (= 270° from positive-x). To land the sector
  // center under the needle: adjustment = (270 - sectorPos) mod 360.
  const raw = (((270 - sectorPos) % 360) + 360) % 360;
  const adjustment = raw === 0 ? 360 : raw;
  return currentSpin + 360 * minRotations + adjustment + (Math.random() * 4 - 2);
}
