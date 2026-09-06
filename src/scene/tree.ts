import * as THREE from 'three';
import { makeRng, lerp, type Rng } from './rng';

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
  height: number;
}

interface GrowOptions {
  height: number;
  spread: number;
  leafCount: number;
}

/**
 * Grows a branch skeleton, then scatters leaves around the terminal tips.
 * Everything is driven by `rng`, so the same URL always yields the same tree.
 */
export function growTree(seed: number, opts: GrowOptions): TreeModel {
  const rng = makeRng(seed);
  const branches: Branch[] = [];
  const tips: Array<{ point: THREE.Vector3; depth: number }> = [];

  const maxDepth = 7;
  // A short trunk keeps the canopy low and heavy, the way the reference reads.
  const trunkLen = opts.height * 0.23;

  const grow = (
    start: THREE.Vector3,
    dir: THREE.Vector3,
    length: number,
    radius: number,
    depth: number,
  ) => {
    const end = start.clone().addScaledVector(dir, length);
    branches.push({ start: start.clone(), end, radius, depth });

    if (depth >= maxDepth || length < 0.35) {
      tips.push({ point: end, depth });
      return;
    }

    // Fewer, fatter splits low down; bushier splits near the crown.
    const children = depth === 0 ? 3 : rng() < 0.28 ? 3 : 2;
    for (let i = 0; i < children; i++) {
      const axis = new THREE.Vector3(rng() * 2 - 1, rng() * 0.35, rng() * 2 - 1).normalize();
      const spreadAngle = lerp(0.55, 0.95, rng()) * (depth === 0 ? 0.62 : 1) * opts.spread;

      const next = dir.clone().applyAxisAngle(axis, spreadAngle);
      // Keep growth generally upward so the canopy stays domed.
      next.y = Math.max(next.y, depth < 3 ? 0.28 : -0.18);
      next.normalize();

      grow(end, next, length * lerp(0.72, 0.85, rng()), radius * 0.68, depth + 1);
    }
  };

  grow(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(rng() * 0.1 - 0.05, 1, rng() * 0.1 - 0.05).normalize(),
    trunkLen,
    opts.height * 0.033,
    0,
  );

  const leaves = scatterLeaves(tips, opts.leafCount, rng);
  const height = branches.reduce((m, b) => Math.max(m, b.end.y), 0);

  return { branches, leaves, height };
}

/** Clusters leaves around the outer tips, biased toward the crown silhouette. */
function scatterLeaves(
  tips: Array<{ point: THREE.Vector3; depth: number }>,
  count: number,
  rng: Rng,
): THREE.Vector3[] {
  const outer = tips.filter((t) => t.depth >= 3);
  const pool = outer.length > 0 ? outer : tips;
  const leaves: THREE.Vector3[] = [];

  for (let i = 0; i < count; i++) {
    const tip = pool[Math.floor(rng() * pool.length)].point;
    // Cluster radius shrinks with height so the crown reads as a dome, not a cube.
    const r = 0.45 + rng() * 0.95;
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);

    leaves.push(
      new THREE.Vector3(
        tip.x + r * Math.sin(phi) * Math.cos(theta),
        tip.y + r * Math.cos(phi) * 0.62,
        tip.z + r * Math.sin(phi) * Math.sin(theta),
      ),
    );
  }

  return leaves;
}

/** Builds the per-branch instance matrix for a unit-height cylinder on +Y. */
const UP = new THREE.Vector3(0, 1, 0);
export function branchMatrix(branch: Branch, out: THREE.Matrix4): THREE.Matrix4 {
  const dir = branch.end.clone().sub(branch.start);
  const len = dir.length();
  const mid = branch.start.clone().addScaledVector(dir, 0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());

  return out.compose(
    mid,
    quat,
    new THREE.Vector3(branch.radius, len, branch.radius),
  );
}
