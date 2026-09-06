export type SpeciesId = 'oak' | 'pine' | 'willow' | 'birch';

export interface Species {
  id: SpeciesId;
  label: string;
  /** Canopy height as a multiple of the plot width. */
  heightFactor: number;
  /** Trunk length as a fraction of total height. */
  trunkFraction: number;
  trunkRadius: number;
  maxDepth: number;
  /** Chance a node throws a third branch instead of two. */
  forkChance: number;
  /** Branching angle away from the parent, in radians. */
  spread: [number, number];
  /** How much shorter each generation gets. */
  lengthDecay: [number, number];
  radiusDecay: number;
  /** Floor on a branch's vertical direction, low in the trunk and up in the crown. */
  upBiasLow: number;
  upBiasHigh: number;
  /** Conifers keep a central leader running straight to the tip. */
  leader: boolean;
  /** Foliage only hangs on branches at least this deep. */
  leafFromDepth: number;
  /** Where along a branch foliage may sit, as a fraction of its length. */
  leafAlong: [number, number];
  /** Leaf cluster radius around each branch tip. */
  cluster: [number, number];
  /** Vertical squash (<1) or stretch (>1) of those clusters. */
  clusterYScale: number;
  leafSize: [number, number];
  /** Narrows the canopy toward the top: 0 is columnar, 1 is a cone. */
  taper: number;
  bark?: { bark: string; barkDark: string };
}

export const SPECIES: Record<SpeciesId, Species> = {
  oak: {
    id: 'oak',
    label: 'Oak',
    heightFactor: 0.86,
    trunkFraction: 0.23,
    trunkRadius: 0.033,
    maxDepth: 7,
    forkChance: 0.28,
    spread: [0.8, 1.38],
    lengthDecay: [0.72, 0.85],
    radiusDecay: 0.68,
    upBiasLow: 0.28,
    upBiasHigh: -0.18,
    leader: false,
    leafFromDepth: 3,
    leafAlong: [0.35, 1],
    cluster: [0.45, 1.4],
    clusterYScale: 0.62,
    leafSize: [0.5, 0.95],
    taper: 0.15,
  },
  pine: {
    id: 'pine',
    label: 'Pine',
    heightFactor: 0.92,
    trunkFraction: 0.2,
    trunkRadius: 0.026,
    maxDepth: 5,
    forkChance: 0.75,
    spread: [1.05, 1.4],
    lengthDecay: [0.6, 0.74],
    radiusDecay: 0.6,
    upBiasLow: -0.12,
    upBiasHigh: -0.32,
    leader: true,
    leafFromDepth: 2,
    leafAlong: [0.08, 1],
    cluster: [0.55, 1.2],
    clusterYScale: 0.6,
    leafSize: [0.45, 0.82],
    taper: 0.35,
    bark: { bark: '#6b5340', barkDark: '#46362a' },
  },
  willow: {
    id: 'willow',
    label: 'Willow',
    heightFactor: 0.74,
    trunkFraction: 0.3,
    trunkRadius: 0.032,
    maxDepth: 7,
    forkChance: 0.3,
    spread: [0.62, 1.05],
    lengthDecay: [0.72, 0.84],
    radiusDecay: 0.66,
    upBiasLow: 0.06,
    upBiasHigh: -1.05,
    leader: false,
    leafFromDepth: 3,
    leafAlong: [0.3, 1],
    cluster: [0.42, 1.05],
    clusterYScale: 2.1,
    leafSize: [0.44, 0.85],
    taper: 0.08,
  },
  birch: {
    id: 'birch',
    label: 'Birch',
    heightFactor: 0.86,
    trunkFraction: 0.26,
    trunkRadius: 0.022,
    maxDepth: 6,
    forkChance: 0.24,
    spread: [0.5, 0.92],
    lengthDecay: [0.72, 0.85],
    radiusDecay: 0.66,
    upBiasLow: 0.4,
    upBiasHigh: 0.1,
    leader: false,
    leafFromDepth: 2,
    leafAlong: [0.35, 1],
    cluster: [0.5, 1.2],
    clusterYScale: 0.85,
    leafSize: [0.5, 0.92],
    taper: 0.45,
    bark: { bark: '#ddd7cb', barkDark: '#9c9386' },
  },
};

export const SPECIES_ORDER: SpeciesId[] = ['oak', 'pine', 'willow', 'birch'];
