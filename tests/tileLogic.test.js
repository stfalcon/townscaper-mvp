import { describe, it, expect } from 'vitest';
import { resolveTile } from '../src/tileLogic.js';

// Helper: build a neighbors object with N horizontal occupied + optional above
function mkNeighbors(horizontal, hasAbove) {
  const directions = ['north', 'south', 'east', 'west'];
  const n = { north: null, south: null, east: null, west: null, above: null, below: null };
  for (let i = 0; i < horizontal; i++) {
    n[directions[i]] = { x: 0, y: 0, z: 0, colorId: 1, tileType: null };
  }
  if (hasAbove) n.above = { x: 0, y: 1, z: 0, colorId: 1, tileType: null };
  return n;
}

describe('resolveTile — TDD §5.1 full 10-case table (AC-F3-04)', () => {
  const fixtures = [
    { horizontal: 0, hasAbove: false, expected: 'roof' },
    { horizontal: 0, hasAbove: true,  expected: 'freestanding' },
    { horizontal: 1, hasAbove: false, expected: 'roof' },
    { horizontal: 1, hasAbove: true,  expected: 'corner' },
    { horizontal: 2, hasAbove: false, expected: 'roof' },
    { horizontal: 2, hasAbove: true,  expected: 'wall' },
    { horizontal: 3, hasAbove: false, expected: 'roof' },
    { horizontal: 3, hasAbove: true,  expected: 'wall' },
    { horizontal: 4, hasAbove: false, expected: 'roof' },
    { horizontal: 4, hasAbove: true,  expected: 'wall' },
  ];

  it.each(fixtures)(
    'horizontal=$horizontal, hasAbove=$hasAbove → $expected',
    ({ horizontal, hasAbove, expected }) => {
      const cell = { x: 0, y: 0, z: 0, colorId: 1, tileType: null };
      const neighbors = mkNeighbors(horizontal, hasAbove);
      expect(resolveTile(cell, neighbors)).toBe(expected);
    },
  );
});

describe('resolveTile — scenarios from AC-F3-01, AC-F3-02', () => {
  it('AC-F3-01: freestanding first block gets tileType=roof', () => {
    // Single cell with no neighbors at all
    const cell = { x: 0, y: 0, z: 0, colorId: 1, tileType: null };
    const neighbors = mkNeighbors(0, false);
    expect(resolveTile(cell, neighbors)).toBe('roof');
  });

  it('AC-F3-02: L-shape 2-floor layout resolves each cell', () => {
    // Setup: (0,0,0), (1,0,0), (0,1,0) exist, we add (2,0,0)
    // Let's verify (0,0,0) with 1 east neighbor + above → 'corner'
    const cell_0_0_0 = { x: 0, y: 0, z: 0, colorId: 1, tileType: null };
    const neighbors_0_0_0 = {
      north: null, south: null, west: null,
      east: { x: 1, y: 0, z: 0, colorId: 1, tileType: null }, // (1,0,0) exists
      above: { x: 0, y: 1, z: 0, colorId: 1, tileType: null }, // (0,1,0) exists
      below: null,
    };
    expect(resolveTile(cell_0_0_0, neighbors_0_0_0)).toBe('corner');

    // (1,0,0) has 1 west (0,0,0) + 1 east (2,0,0), hasAbove=false → 'roof' (no cell above)
    const cell_1_0_0 = { x: 1, y: 0, z: 0, colorId: 1, tileType: null };
    const neighbors_1_0_0 = {
      north: null, south: null,
      west: { x: 0, y: 0, z: 0, colorId: 1, tileType: null },
      east: { x: 2, y: 0, z: 0, colorId: 1, tileType: null },
      above: null,
      below: null,
    };
    expect(resolveTile(cell_1_0_0, neighbors_1_0_0)).toBe('roof');
  });
});

describe('resolveTile — purity guarantees', () => {
  it('does not mutate cell or neighbors', () => {
    const cell = Object.freeze({ x: 0, y: 0, z: 0, colorId: 1, tileType: null });
    const neighbors = Object.freeze(mkNeighbors(2, true));
    expect(() => resolveTile(cell, neighbors)).not.toThrow();
  });

  it('deterministic: same input → same output', () => {
    const cell = { x: 0, y: 0, z: 0, colorId: 1, tileType: null };
    const neighbors = mkNeighbors(1, true);
    expect(resolveTile(cell, neighbors)).toBe(resolveTile(cell, neighbors));
  });
});
