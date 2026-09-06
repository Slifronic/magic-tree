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
  private isoCenter = new THREE.Vector3();
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
   * Measures the scene's screen-space extent at the isometric angle by
   * projecting the plot corners and the canopy's bounding box onto the camera's
   * own screen axes.
   *
   * It records the content's midpoint as well as its size. Sizing around an
   * assumed target instead leaves an asymmetric canopy visibly off-centre.
   */
  private measureIsoFraming(rim: number) {
    const { canopyTop, canopyRadius } = this.canopy.model;

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

    let wMin = Infinity;
    let wMax = -Infinity;
    let vMin = Infinity;
    let vMax = -Infinity;
    for (const pt of points) {
      const w = pt.dot(right);
      const v = pt.dot(up);
      wMin = Math.min(wMin, w);
      wMax = Math.max(wMax, w);
      vMin = Math.min(vMin, v);
      vMax = Math.max(vMax, v);
    }

    this.isoHalfW = (wMax - wMin) / 2;
    this.isoHalfV = (vMax - vMin) / 2;
    // A world point that projects to the middle of the content.
    this.isoCenter
      .set(0, 0, 0)
      .addScaledVector(right, (wMin + wMax) / 2)
      .addScaledVector(up, (vMin + vMax) / 2);
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

    const margin = 1.05;
    const dockPx = Math.min(this.dockPx + 18, h * 0.5);
    const usable = Math.max(h - dockPx, h * 0.4);

    // Both framings use one fit: size the content to the strip *above* the dock,
    // then shift the camera so that strip — not the whole viewport — is what
    // ends up centred. Fitting to the full height and nudging afterwards is what
    // left the scene low with a void above it on tall, narrow screens.
    const fit = (halfW: number, halfV: number) => {
      const half = Math.max(halfV * (h / usable), halfW / aspect) * margin;
      return { half, shift: (half * dockPx) / h };
    };

    const isoFit = fit(this.isoHalfW, this.isoHalfV);
    const halfRim = this.rimUnits / 2;
    const topFit = fit(halfRim, halfRim);

    const half = lerp(isoFit.half, topFit.half, t);
    const shift = lerp(isoFit.shift, topFit.shift, t);

    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.near = -600;
    this.camera.far = 600;
    this.camera.updateProjectionMatrix();

    const azimuth = lerp(ISO_AZIMUTH, 0, t);
    const elevation = lerp(ISO_ELEVATION, TOP_ELEVATION, t);
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

    // Aim at the content's midpoint, easing to the plot centre for the code
    // view, then slide up by the dock offset.
    this.target
      .copy(this.isoCenter)
      .multiplyScalar(1 - t)
      .addScaledVector(this.screenUp, -shift);
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
