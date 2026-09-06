import * as THREE from 'three';
import { makeRng } from './rng';
import type { QrMatrix } from './qr';
import type { Palette } from './palette';

const COUNT = 90;

export interface Motes {
  points: THREE.InstancedMesh;
  update: (dt: number, time: number, visibility: number) => void;
  applyPalette: (p: Palette) => void;
  dispose: () => void;
}

/** Drifting petals/leaves that fall through the canopy while the tree is up. */
export function buildMotes(qr: QrMatrix, palette: Palette): Motes {
  const rng = makeRng(0xfa11);
  const spread = qr.plot * 0.5;
  const ceiling = qr.plot * 0.72;

  const geo = new THREE.BoxGeometry(0.34, 0.1, 0.26);
  const mat = new THREE.MeshLambertMaterial({ transparent: true });
  const points = new THREE.InstancedMesh(geo, mat, COUNT);
  points.frustumCulled = false;

  const state = new Float32Array(COUNT * 6); // x, y, z, fallSpeed, swirl, phase

  for (let i = 0; i < COUNT; i++) {
    state[i * 6] = (rng() - 0.5) * spread * 1.6;
    state[i * 6 + 1] = rng() * ceiling;
    state[i * 6 + 2] = (rng() - 0.5) * spread * 1.6;
    state[i * 6 + 3] = 0.8 + rng() * 1.5;
    state[i * 6 + 4] = 0.3 + rng() * 0.9;
    state[i * 6 + 5] = rng() * Math.PI * 2;
  }

  const applyPalette = (p: Palette) => {
    const rngC = makeRng(0xbeef);
    const pool = p.leaf.map((c) => new THREE.Color(c));
    for (let i = 0; i < COUNT; i++) {
      points.setColorAt(i, pool[Math.floor(rngC() * pool.length)]);
    }
    if (points.instanceColor) points.instanceColor.needsUpdate = true;
  };

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();

  const update = (dt: number, time: number, visibility: number) => {
    mat.opacity = visibility;
    points.visible = visibility > 0.02;
    if (!points.visible) return;

    for (let i = 0; i < COUNT; i++) {
      const o = i * 6;
      state[o + 1] -= state[o + 3] * dt;
      if (state[o + 1] < 0.2) {
        state[o + 1] = ceiling;
        state[o] = (rng() - 0.5) * spread * 1.6;
        state[o + 2] = (rng() - 0.5) * spread * 1.6;
      }

      const swirl = state[o + 4];
      pos.set(
        state[o] + Math.sin(time * swirl + state[o + 5]) * 0.9,
        state[o + 1],
        state[o + 2] + Math.cos(time * swirl * 0.8 + state[o + 5]) * 0.9,
      );
      euler.set(time * swirl, time * swirl * 0.7, state[o + 5]);
      quat.setFromEuler(euler);
      scl.setScalar(1);
      m.compose(pos, quat, scl);
      points.setMatrixAt(i, m);
    }
    points.instanceMatrix.needsUpdate = true;
  };

  applyPalette(palette);

  return {
    points,
    update,
    applyPalette,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}
