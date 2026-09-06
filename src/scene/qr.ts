import QRCode from 'qrcode';

/** Modules of light padding kept clear on every side so scanners lock on. */
export const QUIET_ZONE = 4;

export interface QrMatrix {
  /** Width/height of the payload matrix, excluding the quiet zone. */
  size: number;
  /** size*size booleans, row-major. true = dark module. */
  dark: boolean[];
  /** Cells belonging to a finder or alignment pattern; kept structurally exact. */
  reserved: boolean[];
  darkCells: Array<{ x: number; y: number }>;
  /** Full plot width in modules, including the quiet zone on both sides. */
  plot: number;
  text: string;
}

const isFinder = (x: number, y: number, size: number) => {
  const inBox = (bx: number, by: number) => x >= bx && x < bx + 7 && y >= by && y < by + 7;
  return inBox(0, 0) || inBox(size - 7, 0) || inBox(0, size - 7);
};

/**
 * Encodes `text` with error correction level H. The high redundancy is what lets
 * the canopy sit on top of the plot without breaking the scan.
 */
export function buildQr(text: string): QrMatrix {
  const qr = QRCode.create(text || ' ', { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;
  const data = qr.modules.data;

  const dark: boolean[] = new Array(size * size);
  const reserved: boolean[] = new Array(size * size);
  const darkCells: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const on = !!data[i];
      dark[i] = on;
      reserved[i] = isFinder(x, y, size);
      if (on) darkCells.push({ x, y });
    }
  }

  return { size, dark, reserved, darkCells, plot: size + QUIET_ZONE * 2, text };
}

/** World-space centre of a module, with the plot centred on the origin. */
export function moduleToWorld(x: number, y: number, size: number, cell: number) {
  const half = (size * cell) / 2;
  return {
    x: x * cell - half + cell / 2,
    z: y * cell - half + cell / 2,
  };
}
