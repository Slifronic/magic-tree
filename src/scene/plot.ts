import * as THREE from 'three';
import { buildQr, moduleToWorld, QUIET_ZONE, type QrMatrix } from './qr';
import { CELL, HEDGE_RING } from './constants';
import { makeRng } from './rng';
import type { Palette } from './palette';

export interface PlotMeshes {
  group: THREE.Group;
  tiles: THREE.InstancedMesh;
  hedge: THREE.InstancedMesh;
  slab: THREE.Mesh;
  applyPalette: (p: Palette) => void;
}

/**
 * The ground plot *is* the code: every module is a tile, dark ones sit slightly
 * proud so the pattern reads even before the canopy settles into it.
 */
export function buildPlot(qr: QrMatrix, palette: Palette): PlotMeshes {
  const group = new THREE.Group();
  const plotUnits = qr.plot * CELL;
  const rimUnits = plotUnits + HEDGE_RING * 2 * CELL;

  // ---- base slab -------------------------------------------------------
  const slabGeo = new THREE.BoxGeometry(rimUnits, 0.9, rimUnits);
  const slabMat = new THREE.MeshLambertMaterial({ color: palette.slab });
  const slab = new THREE.Mesh(slabGeo, slabMat);
  slab.position.y = -0.45;
  slab.receiveShadow = true;
  group.add(slab);

  // ---- module tiles ----------------------------------------------------
  const tileGeo = new THREE.BoxGeometry(CELL, 0.3, CELL);
  // Colour comes from instanceColor alone; setting vertexColors would define
  // USE_COLOR and multiply by a missing per-vertex attribute (i.e. black).
  const tileMat = new THREE.MeshLambertMaterial();
  const total = qr.plot * qr.plot;
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, total);
  tiles.receiveShadow = true;
  tiles.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  const m = new THREE.Matrix4();
  const darkFlags: boolean[] = new Array(total);
  let i = 0;

  for (let py = 0; py < qr.plot; py++) {
    for (let px = 0; px < qr.plot; px++) {
      const qx = px - QUIET_ZONE;
      const qy = py - QUIET_ZONE;
      const inside = qx >= 0 && qy >= 0 && qx < qr.size && qy < qr.size;
      const dark = inside ? qr.dark[qy * qr.size + qx] : false;
      darkFlags[i] = dark;

      const { x, z } = moduleToWorld(px, py, qr.plot, CELL);
      // Dark modules stand a little proud of the light field.
      m.makeTranslation(x, dark ? -0.06 : -0.14, z);
      tiles.setMatrixAt(i, m);
      i++;
    }
  }
  tiles.instanceMatrix.needsUpdate = true;
  group.add(tiles);

  // ---- hedge rim -------------------------------------------------------
  const hedge = buildHedge(plotUnits, rimUnits, palette);
  group.add(hedge);

  const applyPalette = (p: Palette) => {
    slabMat.color.set(p.slab);
    const dark = new THREE.Color(p.moduleDark);
    const light = new THREE.Color(p.moduleLight);
    for (let k = 0; k < total; k++) tiles.setColorAt(k, darkFlags[k] ? dark : light);
    if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    paintHedge(hedge, p);
  };

  applyPalette(palette);

  return { group, tiles, hedge, slab, applyPalette };
}

const HEDGE_BLADES = 1800;

/**
 * Grass is confined to the rim *outside* the quiet zone — the four modules of
 * clear margin a scanner needs stay genuinely clear.
 */
function buildHedge(plotUnits: number, rimUnits: number, palette: Palette) {
  const rng = makeRng(0x5eed1eaf);
  const geo = new THREE.BoxGeometry(0.16, 1, 0.16);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshLambertMaterial();
  const mesh = new THREE.InstancedMesh(geo, mat, HEDGE_BLADES);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const inner = plotUnits / 2;
  const outer = rimUnits / 2;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  for (let k = 0; k < HEDGE_BLADES; k++) {
    const side = k % 4;
    const along = rng() * rimUnits - outer;
    const depth = inner + rng() * (outer - inner);

    if (side === 0) pos.set(along, -0.28, -depth);
    else if (side === 1) pos.set(along, -0.28, depth);
    else if (side === 2) pos.set(-depth, -0.28, along);
    else pos.set(depth, -0.28, along);

    e.set((rng() - 0.5) * 0.5, rng() * Math.PI, (rng() - 0.5) * 0.5);
    q.setFromEuler(e);
    scl.set(1, 0.7 + rng() * 1.1, 1);
    m.compose(pos, q, scl);
    mesh.setMatrixAt(k, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  paintHedge(mesh, palette);
  return mesh;
}

function paintHedge(mesh: THREE.InstancedMesh, palette: Palette) {
  const rng = makeRng(0xc0ffee);
  const colors = palette.hedge.map((c) => new THREE.Color(c));
  for (let k = 0; k < mesh.count; k++) {
    mesh.setColorAt(k, colors[Math.floor(rng() * colors.length)]);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export { buildQr };
