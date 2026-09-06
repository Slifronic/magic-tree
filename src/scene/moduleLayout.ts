import { moduleToWorld, QUIET_ZONE, type QrMatrix } from './qr';
import { CELL, LEAVES_PER_MODULE, MODULE_HEIGHT } from './constants';

export interface LeafTarget {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
}

/**
 * Where leaf `index` lands once the canopy has settled into the code.
 *
 * Leaves are handed out in runs of LEAVES_PER_MODULE, one run per dark module,
 * laid out as a flat 3x2 grid at a single uniform height. Keeping the run flat
 * and evenly lit is what makes each module binarise cleanly for a scanner.
 */
export function leafTarget(qr: QrMatrix, index: number): LeafTarget {
  const cell = qr.darkCells[Math.floor(index / LEAVES_PER_MODULE)];
  const slot = index % LEAVES_PER_MODULE;
  const gx = (slot % 3) - 1;
  const gz = Math.floor(slot / 3) - 0.5;

  const { x, z } = moduleToWorld(cell.x + QUIET_ZONE, cell.y + QUIET_ZONE, qr.plot, CELL);

  return {
    x: x + gx / 3,
    y: MODULE_HEIGHT / 2,
    z: z + gz / 2,
    // Slightly oversized so neighbours knit together without a visible gap.
    sx: 0.38,
    sy: MODULE_HEIGHT,
    sz: 0.56,
  };
}

/** Total leaves needed to fill every dark module of `qr`. */
export const leafCountFor = (qr: QrMatrix) => qr.darkCells.length * LEAVES_PER_MODULE;
