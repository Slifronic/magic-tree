import * as THREE from 'three';
import { makeRng, lerp, clamp01, type Rng } from './rng';
import type { Species } from './species';

export interface Branch {
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
  depth: number;
}

export interface TreeModel {
  branches: Branch[];
  /** Resting positions of every leaf while the canopy is grown. */
  leaves: THREE.Vector3[];
  /** Per-leaf size, so each species keeps its own foliage texture. */
  leafScales: number[];
  /** Height of the woody skeleton. */
  height: number;
  /** Top of the foliage, which sits above the branch tips. */
  canopyTop: number;
  /** Furthest leaf from the trunk axis. */
  canopyRadius: number;
}

export interface GrowOptions {
  height: number;
  leafCount: number;
  species: Species;
}

/**
 * Grows a branch skeleton, then scatters leaves around the terminal tips.
 * Everything is driven by `rng`, so the same URL always yields the same tree.
 */
export function growTree(seed: number, opts: GrowOptions): TreeModel {
  if (opts.species.leader) return growConifer(seed, opts);
  const sp = opts.species;
  const rng = makeRng(seed);
  const branches: Branch[] = [];

  const trunkLen = opts.height * sp.trunkFraction;

  const grow = (
    start: THREE.Vector3,
    dir: THREE.Vector3,
    length: number,
    radius: number,
    depth: number,
    onAxis: boolean,
  ) => {
    const end = start.clone().addScaledVector(dir, length);
    branches.push({ start: start.clone(), end, radius, depth });

    if (depth >= sp.maxDepth || length < 0.3) return;

    const children = depth === 0 ? 3 : rng() < sp.forkChance ? 3 : 2;

    for (let i = 0; i < children; i++) {
      // Conifers keep ONE central leader running straight up, and only along the
      // main axis. Letting every branch spawn its own leader turns the tree into
      // an upward broom instead of a fir.
      const isLeader = sp.leader && onAxis && i === 0;

      const angle = isLeader
        ? lerp(0.05, 0.16, rng())
        : lerp(sp.spread[0], sp.spread[1], rng()) * (depth === 0 ? 0.62 : 1);

      // The first two rings are spaced evenly around the compass. Left purely to
      // chance the trunk throws all its weight to one side and the tree leans.
      const axis =
        depth <= 1
          ? tiltAxis((i / children) * Math.PI * 2 + rng() * 0.5 + depth * 1.1)
          : new THREE.Vector3(rng() * 2 - 1, rng() * 0.35, rng() * 2 - 1).normalize();

      const next = dir.clone().applyAxisAngle(axis, angle);
      const floor = depth < 3 ? sp.upBiasLow : sp.upBiasHigh;
      if (isLeader) next.y = Math.max(next.y, 0.85);
      else next.y = Math.max(next.y, floor);
      next.normalize();

      const decay = isLeader
        ? lerp(0.78, 0.88, rng())
        : lerp(sp.lengthDecay[0], sp.lengthDecay[1], rng());

      grow(end, next, length * decay, radius * sp.radiusDecay, depth + 1, isLeader);
    }
  };

  grow(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(rng() * 0.1 - 0.05, 1, rng() * 0.1 - 0.05).normalize(),
    trunkLen,
    opts.height * sp.trunkRadius,
    0,
    true,
  );

  const height = branches.reduce((m, b) => Math.max(m, b.end.y), 0);
  const { leaves, leafScales } = scatterLeaves(branches, opts.leafCount, height, sp, rng);

  return { branches, leaves, leafScales, height, ...canopyBounds(leaves, leafScales, height) };
}

/**
 * A conifer is a straight leader hung with whorls of side branches that shorten
 * toward the top. Modelling that directly gives far better control of the cone
 * than tuning the broadleaf recursion into submission.
 */
function growConifer(seed: number, opts: GrowOptions): TreeModel {
  const sp = opts.species;
  const rng = makeRng(seed);
  const branches: Branch[] = [];

  const height = opts.height;
  const trunkR = opts.height * sp.trunkRadius;
  const whorls = 11;
  const canopyBase = height * 0.16;
  const baseSpan = height * 0.34;

  // Trunk, in segments so it can taper.
  const segs = whorls + 1;
  for (let i = 0; i < segs; i++) {
    const y0 = (height * i) / segs;
    const y1 = (height * (i + 1)) / segs;
    const lean = 0.04 * height;
    branches.push({
      start: new THREE.Vector3(Math.sin(i * 0.7) * lean * 0.06, y0, 0),
      end: new THREE.Vector3(Math.sin((i + 1) * 0.7) * lean * 0.06, y1, 0),
      radius: trunkR * (1 - (i / segs) * 0.75),
      depth: i === 0 ? 0 : 1,
    });
  }

  for (let w = 0; w < whorls; w++) {
    const f = w / (whorls - 1);
    const y = canopyBase + (height - canopyBase) * f;
    // Span shrinks toward the tip; that ratio is the cone.
    const span = baseSpan * (1 - f * 0.92) + 0.4;
    const arms = 5 + Math.floor(rng() * 3);
    const twist = rng() * Math.PI * 2;

    for (let a = 0; a < arms; a++) {
      const az = twist + (a / arms) * Math.PI * 2 + (rng() - 0.5) * 0.35;
      const len = span * lerp(0.8, 1.15, rng());
      const droop = len * lerp(0.18, 0.42, rng());
      const start = new THREE.Vector3(0, y, 0);
      const end = new THREE.Vector3(
        Math.cos(az) * len,
        y - droop,
        Math.sin(az) * len,
      );
      branches.push({ start, end, radius: trunkR * 0.3 * (1 - f * 0.6), depth: 2 });

      // One short forward fork keeps the whorl from looking like spokes.
      if (rng() < 0.75) {
        const mid = start.clone().lerp(end, 0.55);
        const tip = end
          .clone()
          .add(new THREE.Vector3(Math.cos(az + 0.5) * len * 0.4, -droop * 0.4, Math.sin(az + 0.5) * len * 0.4));
        branches.push({ start: mid, end: tip, radius: trunkR * 0.2 * (1 - f * 0.6), depth: 3 });
      }
    }
  }

  const treeHeight = branches.reduce((m, b) => Math.max(m, b.end.y), 0);
  const { leaves, leafScales } = scatterLeaves(branches, opts.leafCount, treeHeight, sp, rng);
  return {
    branches,
    leaves,
    leafScales,
    height: treeHeight,
    ...canopyBounds(leaves, leafScales, treeHeight),
  };
}

/**
 * Scatters leaves along the outer branches, then forces the result into the
 * species silhouette.
 *
 * Sampling along whole branches rather than only at their tips is what keeps a
 * canopy looking full: tip-only clustering leaves visible gaps once the branch
 * structure gets sparse, as it does on a conifer or a birch.
 */
function scatterLeaves(
  branches: Branch[],
  count: number,
  height: number,
  sp: Species,
  rng: Rng,
) {
  const minDepth = sp.leafFromDepth;
  const outer = branches.filter((b) => b.depth >= minDepth);
  const pool = outer.length > 0 ? outer : branches;

  const leaves: THREE.Vector3[] = [];
  const leafScales: number[] = [];

  for (let i = 0; i < count; i++) {
    const branch = pool[Math.floor(rng() * pool.length)];
    // Conifer arms need cover right back to the trunk, or the whorls read as
    // bare spokes; broadleaves keep their inner branches showing.
    const along = lerp(sp.leafAlong[0], sp.leafAlong[1], rng());
    const bx = branch.start.x + (branch.end.x - branch.start.x) * along;
    const by = branch.start.y + (branch.end.y - branch.start.y) * along;
    const bz = branch.start.z + (branch.end.z - branch.start.z) * along;

    const r = lerp(sp.cluster[0], sp.cluster[1], rng());
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const sinPhi = Math.sin(phi);

    // Willows hang: the vertical offset is stretched and pulled downward.
    const vertical = r * Math.cos(phi) * sp.clusterYScale;
    const drop = sp.clusterYScale > 1 ? -Math.abs(vertical) * 0.55 : 0;

    leaves.push(
      new THREE.Vector3(
        bx + r * sinPhi * Math.cos(theta),
        by + vertical + drop,
        bz + r * sinPhi * Math.sin(theta),
      ),
    );
    leafScales.push(lerp(sp.leafSize[0], sp.leafSize[1], rng()));
  }

  applyTaper(leaves, sp.taper, height);
  return { leaves, leafScales };
}

/**
 * Pulls the canopy in toward its axis with height, so `taper` alone decides the
 * silhouette: 0 leaves a broad crown, 1 gives a conifer's cone. Doing this as a
 * post-pass means the branch structure stays organic but the outline is exact.
 */
function applyTaper(leaves: THREE.Vector3[], taper: number, height: number) {
  if (taper <= 0.001 || leaves.length === 0) return;

  let base = Infinity;
  let maxR = 0;
  for (const l of leaves) {
    base = Math.min(base, l.y);
    maxR = Math.max(maxR, Math.hypot(l.x, l.z));
  }
  const span = Math.max(height - base, 0.001);
  if (maxR < 0.001) return;

  for (const l of leaves) {
    const ratio = clamp01((l.y - base) / span);
    const limit = maxR * (1 - taper * ratio);
    const radial = Math.hypot(l.x, l.z);
    if (radial > limit && radial > 0.001) {
      const k = limit / radial;
      l.x *= k;
      l.z *= k;
    }
  }
}

/** Extent of the foliage itself, which the camera has to frame — not the branches. */
function canopyBounds(leaves: THREE.Vector3[], leafScales: number[], fallback: number) {
  let canopyTop = fallback;
  let canopyRadius = 0;
  for (let i = 0; i < leaves.length; i++) {
    const half = (leafScales[i] ?? 0.5) * 0.5;
    canopyTop = Math.max(canopyTop, leaves[i].y + half);
    canopyRadius = Math.max(canopyRadius, Math.hypot(leaves[i].x, leaves[i].z) + half);
  }
  return { canopyTop, canopyRadius };
}

/** A horizontal axis at `azimuth`, for tilting a near-vertical branch evenly. */
function tiltAxis(azimuth: number) {
  return new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
}

/** Builds the per-branch instance matrix for a unit-height cylinder on +Y. */
const UP = new THREE.Vector3(0, 1, 0);
export function branchMatrix(branch: Branch, out: THREE.Matrix4): THREE.Matrix4 {
  const dir = branch.end.clone().sub(branch.start);
  const len = dir.length();
  const mid = branch.start.clone().addScaledVector(dir, 0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());

  return out.compose(mid, quat, new THREE.Vector3(branch.radius, len, branch.radius));
}
