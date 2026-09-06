/** One QR module = one world unit. */
export const CELL = 1;
/** Leaves packed into each dark module when the code is revealed (a 3x2 layer). */
export const LEAVES_PER_MODULE = 6;
/** Height of a settled module block. Uniform, so every top face lights equally. */
export const MODULE_HEIGHT = 0.34;
/** Extra rim outside the quiet zone where the hedge lives, in modules. */
export const HEDGE_RING = 2.4;

export const ISO_AZIMUTH = Math.PI / 4;
export const ISO_ELEVATION = 0.58;
export const TOP_ELEVATION = Math.PI / 2 - 0.0001;
