import * as THREE from 'three';
import { buildQr, type QrMatrix } from './qr';
import { buildPlot, type PlotMeshes } from './plot';
import { buildCanopy, type Canopy } from './canopy';
import { buildMotes, type Motes } from './motes';
import { CELL, HEDGE_RING, ISO_AZIMUTH, ISO_ELEVATION, TOP_ELEVATION } from './constants';
import { clamp01, lerp, easeInOutCubic } from './rng';
import type { Palette } from './palette';
import { SPECIES, type Species, type SpeciesId } from './species';

export type ViewMode = 'tree' | 'code';

/** Seconds for a full canopy <-> code transition. */
const MORPH_SECONDS = 0.95;

export class MagicTreeScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  private key: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private hemi: THREE.HemisphereLight;

  private plot!: PlotMeshes;
  private canopy!: Canopy;
  private motes!: Motes;
  private qr!: QrMatrix;
  private world = new THREE.Group();
  private target = new THREE.Vector3();
  private offset = new THREE.Vector3();
  private forward = new THREE.Vector3();
  private screenUp = new THREE.Vector3();

  private palette: Palette;
  private species: Species;
  private morph = 0;
  private morphTarget = 0;
  private lastTime = 0;
  private elapsed = 0;
  private raf = 0;
  private frame = 0;
  private disposed = false;

  private isoHalfW = 20;
  private isoHalfV = 20;
  private rimUnits = 40;
  /** Height of the control dock in CSS px, reported by the UI. */
  private dockPx = 200;

  onMorphChange?: (t: number) => void;

  private canvas: HTMLCanvasElement;

  constructor(
    canvas: HTMLCanvasElement,
    text: string,
    palette: Palette,
    species: Species = SPECIES.oak,
  ) {
    this.canvas = canvas;
    this.palette = palette;
    this.species = species;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color(palette.ground);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.62);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xd8cfbe, 0.5);
    this.key = new THREE.DirectionalLight(0xfff6e6, 1.15);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0006;
    this.scene.add(this.ambient, this.hemi, this.key, this.key.target);

    this.scene.add(this.world);
    this.build(text);
    this.resize();
    this.lastTime = performance.now();
    this.loop();

    if (import.meta.env.DEV) {
      (window as unknown as { __magicTree?: MagicTreeScene }).__magicTree = this;
    }
  }

  // ---------------------------------------------------------------- build

  private build(text: string) {
    this.qr = buildQr(text);
    this.plot = buildPlot(this.qr, this.palette);
    this.canopy = buildCanopy(this.qr, this.palette, this.species);
    this.motes = buildMotes(this.qr, this.palette);
    this.world.add(this.plot.group, this.canopy.group, this.motes.points);

    const rim = (this.qr.plot + HEDGE_RING * 2) * CELL;
    this.rimUnits = rim;
    this.measureIsoFraming(rim);

    const shadowExtent = rim * 0.8;
    const cam = this.key.shadow.camera;
    cam.left = -shadowExtent;
    cam.right = shadowExtent;
    cam.top = shadowExtent;
    cam.bottom = -shadowExtent;
    cam.near = 1;
    cam.far = 400;
    cam.updateProjectionMatrix();

    this.canopy.setMorph(this.morph, 0);
  }

  /**
   * Measures how much screen space the scene needs at the isometric angle by
   * projecting the plot corners and the canopy's bounding box onto the camera's
   * screen axes. Fitting to the foliage rather than the branch tips is what
   * stops a wide crown being clipped.
   */
  private measureIsoFraming(rim: number) {
    const { canopyTop, canopyRadius } = this.canopy.model;
    const targetY = canopyTop * 0.42;

    const dir = new THREE.Vector3(
      Math.cos(ISO_ELEVATION) * Math.sin(ISO_AZIMUTH),
      Math.sin(ISO_ELEVATION),
      Math.cos(ISO_ELEVATION) * Math.cos(ISO_AZIMUTH),
    ).normalize();
    const forward = dir.clone().negate();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const half = rim / 2;
    const points: THREE.Vector3[] = [
      new THREE.Vector3(-half, 0, -half),
      new THREE.Vector3(half, 0, -half),
      new THREE.Vector3(-half, 0, half),
      new THREE.Vector3(half, 0, half),
    ];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        points.push(new THREE.Vector3(sx * canopyRadius, 0, sz * canopyRadius));
        points.push(new THREE.Vector3(sx * canopyRadius, canopyTop, sz * canopyRadius));
      }
    }

    let w = 0;
    let v = 0;
    const rel = new THREE.Vector3();
    for (const p of points) {
      rel.copy(p).sub(new THREE.Vector3(0, targetY, 0));
      w = Math.max(w, Math.abs(rel.dot(right)));
      v = Math.max(v, Math.abs(rel.dot(up)));
    }
    this.isoHalfW = w * 1.05;
    this.isoHalfV = v * 1.05;
  }

  private teardown() {
    this.world.remove(this.plot.group, this.canopy.group, this.motes.points);
    this.canopy.dispose();
    this.motes.dispose();
    this.plot.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | undefined;
      mat?.dispose();
    });
  }

  // ----------------------------------------------------------------- api

  setText(text: string) {
    if (text === this.qr.text) return;
    this.teardown();
    this.build(text);
  }

  setSpecies(species: SpeciesId | Species) {
    const next = typeof species === 'string' ? SPECIES[species] : species;
    if (next.id === this.species.id) return;
    this.species = next;
    const text = this.qr.text;
    this.teardown();
    this.build(text);
  }

  /** The UI measures its own dock so the code is always framed clear of it. */
  setDockHeight(px: number) {
    const next = Math.max(0, px);
    if (Math.abs(next - this.dockPx) < 1) return;
    this.dockPx = next;
    this.updateCamera(true);
  }

  setPalette(palette: Palette) {
    this.palette = palette;
    (this.scene.background as THREE.Color).set(palette.ground);
    this.plot.applyPalette(palette);
    this.canopy.applyPalette(palette);
    this.motes.applyPalette(palette);
  }

  setMode(mode: ViewMode) {
    this.morphTarget = mode === 'code' ? 1 : 0;
  }

  toggleMode() {
    this.morphTarget = this.morphTarget > 0.5 ? 0 : 1;
    return this.morphTarget > 0.5 ? 'code' : 'tree';
  }

  get mode(): ViewMode {
    return this.morphTarget > 0.5 ? 'code' : 'tree';
  }

  /** PNG of the current framing, for download/share. */
  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.canvas.toDataURL('image/png');
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.updateCamera(true);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.teardown();
    this.renderer.dispose();
  }

  // -------------------------------------------------------------- camera

  /**
   * Frames the crown in the iso view and, in the top-down view, fits the whole
   * plot into the area *above* the control dock so no UI ever covers a module.
   */
  private updateCamera(force = false) {
    // The camera runs on an eased copy of the morph so the swing eases in and
    // out instead of starting and stopping dead.
    const t = easeInOutCubic(this.morph);
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    const aspect = w / h;

    const margin = 1.07;
    const dockPx = Math.min(this.dockPx + 20, h * 0.55);
    const usable = Math.max(h - dockPx, h * 0.5);
    const halfRim = (this.rimUnits / 2) * margin;
    // Whichever axis is tighter decides the zoom.
    const topHalf = Math.max(halfRim * (h / usable), halfRim / aspect);
    // Shift the framing down-world so the plot rides above the dock on screen.
    const topPan = topHalf * (dockPx / h);

    const isoHalf = Math.max(this.isoHalfV, this.isoHalfW / aspect);
    const half = lerp(isoHalf, topHalf, t);
    // The iso view needs a partial shift too, or a tall dock eats the near
    // corner of the plot.
    const shift = lerp(topPan * 0.55, topPan, t);

    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.near = -600;
    this.camera.far = 600;
    this.camera.updateProjectionMatrix();

    const azimuth = lerp(ISO_AZIMUTH, 0, t);
    const elevation = lerp(ISO_ELEVATION, TOP_ELEVATION, t);
    const targetY = lerp(this.canopy.model.canopyTop * 0.42, 0, t);
    const r = 220;

    this.offset.set(
      r * Math.cos(elevation) * Math.sin(azimuth),
      r * Math.sin(elevation),
      r * Math.cos(elevation) * Math.cos(azimuth),
    );

    // Screen-up in world space, so the dock shift works at any camera angle.
    this.forward.copy(this.offset).normalize().negate();
    this.screenUp
      .set(0, 1, 0)
      .addScaledVector(this.forward, -this.forward.y)
      .normalize();

    this.target.set(0, targetY, 0).addScaledVector(this.screenUp, -shift);
    this.camera.position.copy(this.target).add(this.offset);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.target);

    if (force) this.camera.updateMatrixWorld();

    // Flatten the lighting as the code resolves so no shadow crosses a module.
    // Blown-out light modules and near-black dark ones is exactly what a
    // scanner's binariser wants, so push the ambient hard at the end.
    this.key.intensity = lerp(1.15, 0.14, t);
    this.ambient.intensity = lerp(0.62, 2.45, t);
    this.hemi.intensity = lerp(0.5, 0.18, t);
    this.key.castShadow = t < 0.6;
    this.key.position.set(-60, 120, 70).add(this.target);
    this.key.target.position.copy(this.target);
    this.key.target.updateMatrixWorld();
  }

  // ---------------------------------------------------------------- loop

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.elapsed += dt;
    const time = this.elapsed;

    if (this.morph !== this.morphTarget) {
      const step = dt / MORPH_SECONDS;
      const dir = Math.sign(this.morphTarget - this.morph);
      this.morph = clamp01(
        dir > 0 ? Math.min(this.morph + step, this.morphTarget)
                : Math.max(this.morph - step, this.morphTarget),
      );
      this.onMorphChange?.(this.morph);
    }

    // Idle sway only matters while the canopy is up; skip work once settled.
    const idle = this.morph < 0.999;
    if (idle || this.frame < 2) this.canopy.setMorph(this.morph, time);
    this.motes.update(dt, time, 1 - this.morph);

    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
    this.frame++;
  };
}
