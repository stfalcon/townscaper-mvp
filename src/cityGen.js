import { GRID_SIZE, MAX_HEIGHT } from './constants.js';

/**
 * mulberry32 — tiny deterministic PRNG, suffices for reproducible cities.
 * Produces [0,1) just like Math.random().
 */
export function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const MIN_LAND = 25;
const MAX_LAND = 45;
const MIN_BUILDINGS = 20;
const MAX_BUILDINGS = 40;
const STAGGER_MS = 40;

/**
 * Generate a small seeded island with houses on top. Cells are emitted with
 * a timing schedule so the Renderer's per-cell scale tween creates a visible
 * cascade (land first, then buildings rising on top).
 *
 * Returns the full schedule as { steps: [{at, op}] } so tests can inspect
 * ordering without waiting for real time.
 *
 * `now()` defaults to performance.now() — pass a stub in tests.
 */
export function generateCity({
  state, seed = Date.now() >>> 0, clock = () => performance.now(),
  schedule = (fn, ms) => setTimeout(fn, ms),
}) {
  const rng = mulberry32(seed);
  const cx = Math.floor(GRID_SIZE / 2);
  const cz = Math.floor(GRID_SIZE / 2);

  // --- Phase 1: BFS irregular land island ---
  const landTargets = MIN_LAND + Math.floor(rng() * (MAX_LAND - MIN_LAND + 1));
  const landCells = [];
  const visited = new Set();
  const queue = [{ x: cx, z: cz }];
  const keyOf = (x, z) => `${x}_${z}`;

  while (queue.length && landCells.length < landTargets) {
    // Random-pop for irregular shape (not strictly BFS).
    const idx = Math.floor(rng() * queue.length);
    const { x, z } = queue.splice(idx, 1)[0];
    const k = keyOf(x, z);
    if (visited.has(k)) continue;
    visited.add(k);
    if (x < 1 || x >= GRID_SIZE - 1 || z < 1 || z >= GRID_SIZE - 1) continue;
    if (state.getCell(x, 0, z)) continue;

    landCells.push({ x, z });

    // Push neighbors with probability — creates organic blobby shape.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (rng() < 0.75) queue.push({ x: x + dx, z: z + dz });
    }
  }

  // --- Phase 2: buildings on land ---
  const buildingTargets = MIN_BUILDINGS + Math.floor(rng() * (MAX_BUILDINGS - MIN_BUILDINGS + 1));
  const buildings = [];
  const landKeys = new Set(landCells.map(({ x, z }) => keyOf(x, z)));
  const shuffled = [...landCells].sort(() => rng() - 0.5);

  for (const { x, z } of shuffled) {
    if (buildings.length >= buildingTargets) break;
    // Per-column decide height 1..3 (weighted toward 1-2).
    const r = rng();
    const height = r < 0.5 ? 1 : r < 0.85 ? 2 : 3;
    const colorId = 1 + Math.floor(rng() * 5);
    for (let h = 1; h <= height; h++) {
      buildings.push({ x, y: h, z, colorId });
    }
  }

  // --- Phase 3: schedule placements with stagger ---
  const steps = [];
  let at = 0;
  for (const { x, z } of landCells) {
    steps.push({ at, op: 'land', x, z });
    at += STAGGER_MS;
  }
  // Small pause so land finishes its bounce before buildings rise.
  at += 150;
  for (const { x, y, z, colorId } of buildings) {
    steps.push({ at, op: 'building', x, y, z, colorId });
    at += STAGGER_MS;
  }

  for (const step of steps) {
    schedule(() => {
      if (step.op === 'land') {
        if (state.canPlace(step.x, 0, step.z, 'land').ok) {
          state.setCell(step.x, 0, step.z, { type: 'land' });
        }
      } else {
        if (state.canPlace(step.x, step.y, step.z).ok) {
          state.setCell(step.x, step.y, step.z, {
            colorId: step.colorId, type: 'building',
          });
        }
      }
    }, step.at);
  }

  return { steps, seed, durationMs: at, landCount: landCells.length, buildingCount: buildings.length };
}
