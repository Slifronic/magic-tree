import { describe, it, expect } from 'vitest';
import { buildQr, moduleToWorld, QUIET_ZONE } from '../qr';
import { leafTarget, leafCountFor } from '../moduleLayout';
import { LEAVES_PER_MODULE } from '../constants';
import { growTree } from '../tree';
import { SPECIES, SPECIES_ORDER } from '../species';
import { hashString, makeRng } from '../rng';

const SAMPLES = [
  'hi',
  'Magic Tree',
  'hello world',
  'https://example.com',
  'https://github.com/anthropics',
  'https://a-much-longer-example-domain.co.uk/path/to/page?ref=magic-tree',
];

describe('buildQr', () => {
  it('produces a square matrix of a valid QR version size', () => {
    for (const text of SAMPLES) {
      const qr = buildQr(text);
      expect(qr.size).toBeGreaterThanOrEqual(21);
      expect((qr.size - 21) % 4).toBe(0);
      expect(qr.dark).toHaveLength(qr.size * qr.size);
      expect(qr.plot).toBe(qr.size + QUIET_ZONE * 2);
    }
  });

  it('keeps darkCells in sync with the matrix', () => {
    for (const text of SAMPLES) {
      const qr = buildQr(text);
      const fromMatrix = qr.dark.filter(Boolean).length;
      expect(qr.darkCells).toHaveLength(fromMatrix);
      for (const c of qr.darkCells) expect(qr.dark[c.y * qr.size + c.x]).toBe(true);
    }
  });

  it('places the three finder patterns', () => {
    const qr = buildQr('https://example.com');
    const at = (x: number, y: number) => qr.dark[y * qr.size + x];
    const corners: Array<[number, number]> = [
      [0, 0],
      [qr.size - 7, 0],
      [0, qr.size - 7],
    ];
    for (const [ox, oy] of corners) {
      // Outer ring dark, inner ring light, 3x3 core dark.
      expect(at(ox + 0, oy + 0)).toBe(true);
      expect(at(ox + 1, oy + 1)).toBe(false);
      expect(at(ox + 3, oy + 3)).toBe(true);
      expect(qr.reserved[oy * qr.size + ox]).toBe(true);
    }
  });

  it('is deterministic for the same input', () => {
    const a = buildQr('https://example.com');
    const b = buildQr('https://example.com');
    expect(a.dark).toEqual(b.dark);
  });
});

describe('leaf targets', () => {
  it('gives every dark module exactly LEAVES_PER_MODULE leaves', () => {
    for (const text of SAMPLES) {
      const qr = buildQr(text);
      const perCell = new Map<string, number>();

      for (let i = 0; i < leafCountFor(qr); i++) {
        const t = leafTarget(qr, i);
        // Recover the module this leaf landed on from its world position.
        const mx = Math.floor((t.x + qr.plot / 2) / 1);
        const mz = Math.floor((t.z + qr.plot / 2) / 1);
        const key = `${mx},${mz}`;
        perCell.set(key, (perCell.get(key) ?? 0) + 1);
      }

      expect(perCell.size).toBe(qr.darkCells.length);
      for (const count of perCell.values()) expect(count).toBe(LEAVES_PER_MODULE);
    }
  });

  it('only ever lands leaves on dark modules, never the quiet zone', () => {
    for (const text of SAMPLES) {
      const qr = buildQr(text);
      for (let i = 0; i < leafCountFor(qr); i++) {
        const t = leafTarget(qr, i);
        const mx = Math.floor(t.x + qr.plot / 2);
        const mz = Math.floor(t.z + qr.plot / 2);

        expect(mx).toBeGreaterThanOrEqual(QUIET_ZONE);
        expect(mz).toBeGreaterThanOrEqual(QUIET_ZONE);
        expect(mx).toBeLessThan(qr.plot - QUIET_ZONE);
        expect(mz).toBeLessThan(qr.plot - QUIET_ZONE);

        const qx = mx - QUIET_ZONE;
        const qz = mz - QUIET_ZONE;
        expect(qr.dark[qz * qr.size + qx]).toBe(true);
      }
    }
  });

  it('keeps a module block inside its own cell (no bleed past ~5%)', () => {
    const qr = buildQr('https://example.com');
    for (let i = 0; i < leafCountFor(qr); i++) {
      const t = leafTarget(qr, i);
      const cx = Math.floor(t.x + qr.plot / 2) - qr.plot / 2 + 0.5;
      const cz = Math.floor(t.z + qr.plot / 2) - qr.plot / 2 + 0.5;
      expect(Math.abs(t.x - cx) + t.sx / 2).toBeLessThanOrEqual(0.55);
      expect(Math.abs(t.z - cz) + t.sz / 2).toBeLessThanOrEqual(0.55);
    }
  });

  it('gives every module block the same height, so all top faces light equally', () => {
    const qr = buildQr('Magic Tree');
    const ys = new Set<number>();
    const heights = new Set<number>();
    for (let i = 0; i < leafCountFor(qr); i++) {
      const t = leafTarget(qr, i);
      ys.add(t.y);
      heights.add(t.sy);
    }
    expect(ys.size).toBe(1);
    expect(heights.size).toBe(1);
  });
});

describe('moduleToWorld', () => {
  it('centres the plot on the origin', () => {
    const size = 10;
    const first = moduleToWorld(0, 0, size, 1);
    const last = moduleToWorld(size - 1, size - 1, size, 1);
    expect(first.x).toBeCloseTo(-(size / 2) + 0.5);
    expect(last.x).toBeCloseTo(size / 2 - 0.5);
    expect(first.x).toBeCloseTo(-last.x);
  });
});

describe('tree growth', () => {
  it('is deterministic for a given seed', () => {
    const opts = { height: 30, leafCount: 240, species: SPECIES.oak };
    const a = growTree(hashString('https://example.com'), opts);
    const b = growTree(hashString('https://example.com'), opts);
    expect(a.leaves.map((v) => v.toArray())).toEqual(b.leaves.map((v) => v.toArray()));
  });

  it('differs between seeds', () => {
    const opts = { height: 30, leafCount: 240, species: SPECIES.oak };
    const a = growTree(hashString('one'), opts);
    const b = growTree(hashString('two'), opts);
    expect(a.leaves[0].toArray()).not.toEqual(b.leaves[0].toArray());
  });

  it('produces exactly the requested number of leaves and grows upward', () => {
    const tree = growTree(1234, { height: 30, leafCount: 500, species: SPECIES.oak });
    expect(tree.leaves).toHaveLength(500);
    expect(tree.height).toBeGreaterThan(10);
    expect(tree.branches.length).toBeGreaterThan(50);
  });
});

describe('rng', () => {
  it('stays in [0, 1) and is reproducible', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    for (let i = 0; i < 500; i++) {
      const v = a();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(v).toBe(b());
    }
  });
});

describe('species', () => {
  const opts = { height: 32, leafCount: 600 };

  it('every species grows a usable tree', () => {
    for (const id of SPECIES_ORDER) {
      const tree = growTree(hashString(id), { ...opts, species: SPECIES[id] });
      expect(tree.leaves).toHaveLength(opts.leafCount);
      expect(tree.leafScales).toHaveLength(opts.leafCount);
      expect(tree.branches.length).toBeGreaterThan(20);
      expect(tree.height).toBeGreaterThan(opts.height * 0.3);
      for (const leaf of tree.leaves) expect(Number.isFinite(leaf.y)).toBe(true);
    }
  });

  it('gives each species a distinct silhouette', () => {
    // Match how the canopy actually calls it: plot width scaled by heightFactor.
    const shape = (id: (typeof SPECIES_ORDER)[number]) => {
      const sp = SPECIES[id];
      const tree = growTree(99, { ...opts, height: 37 * sp.heightFactor, species: sp });
      let maxR = 0;
      for (const l of tree.leaves) maxR = Math.max(maxR, Math.hypot(l.x, l.z));
      return { ratio: maxR / tree.height, height: tree.height };
    };
    const oak = shape('oak');
    const pine = shape('pine');
    const birch = shape('birch');

    // A conifer is markedly narrower for its height than a broadleaf.
    expect(pine.ratio).toBeLessThan(oak.ratio);
    expect(birch.ratio).toBeLessThan(oak.ratio);
    expect(pine.height).toBeGreaterThan(oak.height);
  });

  it('tapers the crown of a conifer', () => {
    const tree = growTree(7, { ...opts, species: SPECIES.pine });
    const spreadAt = (lo: number, hi: number) => {
      const band = tree.leaves.filter((l) => l.y >= tree.height * lo && l.y < tree.height * hi);
      if (!band.length) return 0;
      return Math.max(...band.map((l) => Math.hypot(l.x, l.z)));
    };
    expect(spreadAt(0.75, 1.0)).toBeLessThan(spreadAt(0.25, 0.5));
  });
});
