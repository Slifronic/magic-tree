# Magic Tree

An isometric 3D tree whose plot **is** a scannable QR code. Tap it and the canopy
comes apart leaf by leaf, each one flying down into a module of the code below.

![The tree, summer](docs/tree.png)

| Tap to reveal the code | Repaint the blossom |
| --- | --- |
| ![The revealed QR code](docs/code.png) | ![Spring blossom](docs/spring.png) |

Type a link, pick a season, and the tree regrows around it. The result actually
scans — that constraint drove most of the interesting decisions below.

## Running it

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm test` | Run the test suite |
| `npm run lint` | Lint with oxlint |

## How it works

### The plot is the code

There is no QR texture pasted onto the ground. The plot is an `InstancedMesh` of
one tile per module, and dark modules sit slightly proud of the light field so
the pattern reads even while the canopy is still up.

The payload is encoded at **error-correction level H** (30 % redundancy) with a
four-module quiet zone, so the code survives a canopy sitting on top of it.

### The morph

Every leaf knows two positions: where it rests on a branch, and which module it
belongs to once the code resolves. A single `morph` value in `[0, 1]` drives
everything — leaf position, scale, tumble, colour, and the camera swinging from
isometric to straight overhead.

Leaves are handed out in runs of six, one run per dark module, and each run is
laid out as a flat 3×2 grid at a **uniform** height:

```
src/scene/moduleLayout.ts   →  leafTarget(qr, index)
```

That uniformity is load-bearing. An earlier version stacked leaves in two layers
and tinted each leaf independently, which left visible seams and height steps
inside every module. Cell centres still sampled correctly, but the intra-module
noise was enough to defeat a scanner's binariser. One flat layer, one tone per
module, and the codes decode.

### Keeping it scannable

Three things are tuned specifically for scanners rather than for looks:

- **Ambient light ramps up** as the code resolves (`0.62 → 2.45`) and the key
  light drops away, so light modules blow out to near-white, dark modules stay
  deep, and no shadow ever falls across the pattern.
- **The blossom palette has two tones per swatch** — a bright canopy colour and a
  much deeper `qr` colour. Pretty pinks and honeys are far too light to binarise
  against a pale plot, so they darken on the way down.
- **The grass rim sits outside the quiet zone**, never on it.

The camera also fits the plot into the area *above* the control dock, so no part
of the UI can ever cover a module.

### Determinism

The tree is grown from a hash of the link, so the same URL always produces the
same tree — same branches, same leaf scatter — while a different one grows
something new.

## Tests

```bash
npm test
```

The suite covers the parts that can be checked without a GPU: QR matrix
structure and finder patterns, that every dark module receives exactly six
leaves, that no leaf ever lands on a light module or in the quiet zone, that
module blocks stay inside their own cell, that every block shares one height,
and that tree growth is deterministic per seed.

Scannability itself was verified in the browser by rendering the settled code and
decoding it back with [jsQR](https://github.com/cozmo/jsQR) — 30/30 across all
three seasons, all six blossom swatches, and codes from version 21 up to 49.

## Stack

React 19, three.js, TypeScript, Vite. No 3D asset files — the tree, the plot, the
grass, and the falling leaves are all generated at runtime. Ambience is
synthesised with the Web Audio API rather than shipped as samples.

## Credits

An original, open-source take on the isometric QR-tree idea, inspired by
[tree.icqr.com](https://tree.icqr.com). No code, art, or branding from that site
is used here — everything in this repository was written from scratch.

## Licence

MIT — see [LICENSE](LICENSE).
