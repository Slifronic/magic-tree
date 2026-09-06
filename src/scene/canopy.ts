import * as THREE from 'three';
import { growTree, branchMatrix, type TreeModel } from './tree';
import { type QrMatrix } from './qr';
import { leafTarget, leafCountFor } from './moduleLayout';
import { LEAVES_PER_MODULE } from './constants';
import { hashString, makeRng, clamp01 } from './rng';
import type { Palette } from './palette';

export interface Canopy {
  group: THREE.Group;
  leaves: THREE.InstancedMesh;
  branches: THREE.InstancedMesh;
  model: TreeModel;
  leafCount: number;
  /** 0 = grown tree, 1 = settled into the code. */
  setMorph: (t: number, time: number) => void;
  applyPalette: (p: Palette) => void;
  dispose: () => void;
}

/**
 * Builds the tree and, for every leaf, the module cell it flies down to.
 * Leaf count is derived from the code so each dark module ends up evenly packed.
 */
export function buildCanopy(qr: QrMatrix, palette: Palette): Canopy {
  const seed = hashString(qr.text);
  const rng = makeRng(seed ^ 0x9e3779b9);

  const darkCells = qr.darkCells;
  const leafCount = leafCountFor(qr);
  const treeHeight = qr.plot * 0.86;

  const model = growTree(seed, {
    height: treeHeight,
    spread: 1.45,
    leafCount,
  });

  const group = new THREE.Group();

  // ---- branches --------------------------------------------------------
  const branchGeo = new THREE.CylinderGeometry(0.42, 1, 1, 6, 1);
  const branchMat = new THREE.MeshLambertMaterial();
  const branches = new THREE.InstancedMesh(branchGeo, branchMat, model.branches.length);
  branches.castShadow = true;

  const m = new THREE.Matrix4();
  model.branches.forEach((b, i) => branches.setMatrixAt(i, branchMatrix(b, m)));
  branches.instanceMatrix.needsUpdate = true;
  group.add(branches);

  // ---- leaves ----------------------------------------------------------
  const leafGeo = new THREE.BoxGeometry(1, 1, 1);
  const leafMat = new THREE.MeshLambertMaterial();
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
  leaves.castShadow = true;
  leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(leaves);

  const treePos = new Float32Array(leafCount * 3);
  const qrPos = new Float32Array(leafCount * 3);
  const treeScale = new Float32Array(leafCount);
  const qrScale = new Float32Array(leafCount * 3);
  const phase = new Float32Array(leafCount);
  const delay = new Float32Array(leafCount);
  const spin = new Float32Array(leafCount * 3);

  // Each dark module receives LEAVES_PER_MODULE leaves in a 2 x 2 x N stack.
  for (let i = 0; i < leafCount; i++) {
    const src = model.leaves[i];
    treePos[i * 3] = src.x;
    treePos[i * 3 + 1] = src.y;
    treePos[i * 3 + 2] = src.z;
    treeScale[i] = 0.5 + rng() * 0.45;
    phase[i] = rng() * Math.PI * 2;
    spin[i * 3] = rng() * Math.PI;
    spin[i * 3 + 1] = rng() * Math.PI;
    spin[i * 3 + 2] = rng() * Math.PI;

    const target = leafTarget(qr, i);
    qrPos[i * 3] = target.x;
    qrPos[i * 3 + 1] = target.y;
    qrPos[i * 3 + 2] = target.z;
    qrScale[i * 3] = target.sx;
    qrScale[i * 3 + 1] = target.sy;
    qrScale[i * 3 + 2] = target.sz;

    // Outer leaves start moving first, which reads as the canopy unfurling.
    delay[i] = clamp01(0.0001 + rng() * 0.35);
  }

  const treeColors = new Float32Array(leafCount * 3);
  const qrColors = new Float32Array(leafCount * 3);

  const applyPalette = (p: Palette) => {
    const rngC = makeRng(seed ^ 0x1234abcd);
    const leafPool = p.leaf.map((c) => new THREE.Color(c));
    const qrPool = p.qrLeaf.map((c) => new THREE.Color(c));

    // One tone per module, shared by all its leaves, so each block is flat.
    const rngM = makeRng(seed ^ 0x77aa33);
    const moduleTone = Array.from(
      { length: darkCells.length },
      () => qrPool[Math.floor(rngM() * qrPool.length)],
    );

    for (let i = 0; i < leafCount; i++) {
      const a = leafPool[Math.floor(rngC() * leafPool.length)];
      const b = moduleTone[Math.floor(i / LEAVES_PER_MODULE)];
      treeColors[i * 3] = a.r; treeColors[i * 3 + 1] = a.g; treeColors[i * 3 + 2] = a.b;
      qrColors[i * 3] = b.r; qrColors[i * 3 + 1] = b.g; qrColors[i * 3 + 2] = b.b;
    }
    const bark = new THREE.Color(p.bark);
    const barkDark = new THREE.Color(p.barkDark);
    model.branches.forEach((b, i) =>
      branches.setColorAt(i, b.depth <= 1 ? barkDark : bark),
    );
    if (branches.instanceColor) branches.instanceColor.needsUpdate = true;
    paintedFor = -1; // force a colour rewrite on the next frame
  };

  const mat4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const color = new THREE.Color();
  let paintedFor = -1;

  const setMorph = (t: number, time: number) => {
    const settled = t > 0.999;
    for (let i = 0; i < leafCount; i++) {
      // Stagger: each leaf runs its own eased sub-window of the global morph.
      const d = delay[i];
      const local = clamp01((t - d) / (1 - d));
      const e = local < 0.5 ? 4 * local ** 3 : 1 - (-2 * local + 2) ** 3 / 2;

      // A gentle breeze while the canopy is up; dead still once it is a code.
      const sway = (1 - e) * 0.09 * Math.sin(time * 0.9 + phase[i]);
      // Leaves arc upward before dropping into place.
      const lift = Math.sin(e * Math.PI) * 1.6;

      pos.set(
        treePos[i * 3] + (qrPos[i * 3] - treePos[i * 3]) * e + sway,
        treePos[i * 3 + 1] + (qrPos[i * 3 + 1] - treePos[i * 3 + 1]) * e + lift,
        treePos[i * 3 + 2] + (qrPos[i * 3 + 2] - treePos[i * 3 + 2]) * e + sway * 0.6,
      );

      const ts = treeScale[i];
      scl.set(
        ts + (qrScale[i * 3] - ts) * e,
        ts + (qrScale[i * 3 + 1] - ts) * e,
        ts + (qrScale[i * 3 + 2] - ts) * e,
      );

      // Tumble in flight, then snap square so the modules stay crisp.
      const spinAmt = Math.sin(e * Math.PI) * 1.2;
      euler.set(
        spin[i * 3] * (1 - e) + spinAmt,
        spin[i * 3 + 1] * (1 - e) + spinAmt,
        spin[i * 3 + 2] * (1 - e),
      );
      quat.setFromEuler(euler);

      mat4.compose(pos, quat, scl);
      leaves.setMatrixAt(i, mat4);

      if (paintedFor !== t) {
        color.setRGB(
          treeColors[i * 3] + (qrColors[i * 3] - treeColors[i * 3]) * e,
          treeColors[i * 3 + 1] + (qrColors[i * 3 + 1] - treeColors[i * 3 + 1]) * e,
          treeColors[i * 3 + 2] + (qrColors[i * 3 + 2] - treeColors[i * 3 + 2]) * e,
        );
        leaves.setColorAt(i, color);
      }
    }
    leaves.instanceMatrix.needsUpdate = true;
    if (paintedFor !== t && leaves.instanceColor) {
      leaves.instanceColor.needsUpdate = true;
      paintedFor = t;
    }
    // Once flat, the canopy must not cast anything onto the code.
    leaves.castShadow = !settled;
    branches.visible = t < 0.985;
  };

  const dispose = () => {
    branchGeo.dispose();
    branchMat.dispose();
    leafGeo.dispose();
    leafMat.dispose();
  };

  applyPalette(palette);

  return { group, leaves, branches, model, leafCount, setMorph, applyPalette, dispose };
}
