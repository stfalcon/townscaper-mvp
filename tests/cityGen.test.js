import { describe, it, expect, beforeEach } from 'vitest';
import { generateCity, mulberry32 } from '../src/cityGen.js';
import { GameState } from '../src/gameState.js';
import { TileResolver } from '../src/tileResolver.js';

/**
 * Synchronous schedule helper — invokes callbacks inline so tests can
 * inspect final state without real timers.
 */
const immediateSchedule = (fn) => fn();

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });
});

describe('generateCity', () => {
  let state, resolver;
  beforeEach(() => {
    state = new GameState();
    resolver = new TileResolver(state);
  });

  it('produces a contiguous land island (every land cell connected)', () => {
    generateCity({ state, seed: 123, schedule: immediateSchedule });
    const landCells = state.all().filter((c) => c.type === 'land');
    expect(landCells.length).toBeGreaterThanOrEqual(20);

    // Flood-fill from the first land — everything must be reachable.
    const seen = new Set();
    const key = (x, z) => `${x}_${z}`;
    const start = landCells[0];
    const stack = [{ x: start.x, z: start.z }];
    while (stack.length) {
      const { x, z } = stack.pop();
      if (seen.has(key(x, z))) continue;
      if (!state.getCell(x, 0, z) || state.getCell(x, 0, z).type !== 'land') continue;
      seen.add(key(x, z));
      stack.push({ x: x + 1, z }, { x: x - 1, z }, { x, z: z + 1 }, { x, z: z - 1 });
    }
    expect(seen.size).toBe(landCells.length);
  });

  it('places buildings only on land (never floating)', () => {
    generateCity({ state, seed: 7, schedule: immediateSchedule });
    const buildings = state.all().filter((c) => c.type === 'building');
    expect(buildings.length).toBeGreaterThan(0);
    for (const b of buildings) {
      expect(b.y).toBeGreaterThanOrEqual(1);
      // Something supports it — either land directly below or a lower-y
      // building in the same column.
      const below = state.getCell(b.x, b.y - 1, b.z);
      expect(below).not.toBeNull();
    }
  });

  it('is deterministic for a fixed seed', () => {
    generateCity({ state, seed: 555, schedule: immediateSchedule });
    const snapshotA = state.all()
      .map((c) => `${c.x},${c.y},${c.z},${c.type},${c.colorId}`)
      .sort();

    const state2 = new GameState();
    new TileResolver(state2);
    generateCity({ state: state2, seed: 555, schedule: immediateSchedule });
    const snapshotB = state2.all()
      .map((c) => `${c.x},${c.y},${c.z},${c.type},${c.colorId}`)
      .sort();

    expect(snapshotA).toEqual(snapshotB);
  });

  it('returns schedule metadata with land-first ordering', () => {
    const result = generateCity({ state, seed: 11, schedule: immediateSchedule });
    expect(result.landCount).toBeGreaterThan(0);
    expect(result.buildingCount).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(0);
    const firstOp = result.steps[0].op;
    const lastOp = result.steps[result.steps.length - 1].op;
    expect(firstOp).toBe('land');
    expect(lastOp).toBe('building');
  });

  it('all scheduled land placements respect canPlace(land)', () => {
    // If this fails the generator produced a disjoint piece.
    const result = generateCity({ state, seed: 999, schedule: immediateSchedule });
    const landSteps = result.steps.filter((s) => s.op === 'land').length;
    const actualLand = state.all().filter((c) => c.type === 'land').length;
    expect(actualLand).toBe(landSteps);
  });
});
