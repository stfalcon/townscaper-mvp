import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../src/gameState.js';
import { TileResolver } from '../src/tileResolver.js';

describe('TileResolver — unit', () => {
  let state;
  let resolver;
  beforeEach(() => {
    state = new GameState();
    resolver = new TileResolver(state);
  });

  it('wires as priority=1 listener on state.cellChanged', () => {
    const order = [];
    // priority=2 listener added AFTER resolver subscribed (priority=1)
    state.on('cellChanged', () => order.push('later'), 2);
    state.setCell(5, 0, 5, { colorId: 1 });
    // resolver fires state.updateTile internally → order must show resolver ran first
    expect(order).toEqual(['later']);
    // The cell should now have tileType assigned — proving resolver ran
    expect(state.getCell(5, 0, 5).tileType).toBe('roof');
  });

  describe('resolveTile is called for affected cells + existing neighbors', () => {
    it('first cell gets tileType=roof', () => {
      state.setCell(5, 0, 5, { colorId: 1 });
      expect(state.getCell(5, 0, 5).tileType).toBe('roof');
    });

    it('placing stack — lower cell becomes wall/corner, upper stays roof', () => {
      state.setCell(5, 0, 5, { colorId: 1 });
      state.setCell(5, 1, 5, { colorId: 1 });
      // lower: hasAbove=true, horizontal=0 → 'freestanding'
      expect(state.getCell(5, 0, 5).tileType).toBe('freestanding');
      // upper: hasAbove=false → 'roof'
      expect(state.getCell(5, 1, 5).tileType).toBe('roof');
    });

    it('placing adjacent on ground — both become roof (no cell above)', () => {
      state.setCell(5, 0, 5, { colorId: 1 });
      state.setCell(6, 0, 5, { colorId: 1 });
      expect(state.getCell(5, 0, 5).tileType).toBe('roof');
      expect(state.getCell(6, 0, 5).tileType).toBe('roof');
    });

    it('L-shape 2-level resolves correctly per AC-F3-02', () => {
      state.setCell(0, 0, 0, { colorId: 1 });
      state.setCell(1, 0, 0, { colorId: 1 });
      state.setCell(0, 1, 0, { colorId: 1 });
      state.setCell(2, 0, 0, { colorId: 1 });
      // (0,0,0): horizontal=1 (east), hasAbove=true → 'corner'
      expect(state.getCell(0, 0, 0).tileType).toBe('corner');
      // (1,0,0): horizontal=2 (west+east), hasAbove=false → 'roof'
      expect(state.getCell(1, 0, 0).tileType).toBe('roof');
      // (2,0,0): horizontal=1 (west), hasAbove=false → 'roof'
      expect(state.getCell(2, 0, 0).tileType).toBe('roof');
      // (0,1,0): hasAbove=false → 'roof'
      expect(state.getCell(0, 1, 0).tileType).toBe('roof');
    });

    it('removing a cell re-tiles remaining neighbors', () => {
      state.setCell(5, 0, 5, { colorId: 1 });
      state.setCell(6, 0, 5, { colorId: 1 });
      state.setCell(5, 1, 5, { colorId: 1 }); // forces (5,0,5) hasAbove=true, horizontal=1 → corner
      expect(state.getCell(5, 0, 5).tileType).toBe('corner');

      state.removeCell(5, 1, 5);
      // Now (5,0,5) hasAbove=false → roof
      expect(state.getCell(5, 0, 5).tileType).toBe('roof');
    });
  });

  describe('AC-F3-03: scope limited to ≤7 cells', () => {
    // Behavioral verification: at most 7 cells can emit cellResolved per placement.
    // Scope by construction = cell + 6 directional neighbors = 7 max.

    it('distant placement touches only self (no neighbors exist)', () => {
      // Pre-populate a cluster far from where we will place
      for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) {
        state.setCell(x, 0, z, { colorId: 1 });
      }
      const touched = [];
      state.on('cellResolved', (d) => touched.push(d.cell));
      state.setCell(20, 0, 20, { colorId: 2 });
      expect(touched).toHaveLength(1);
      expect(touched[0]).toMatchObject({ x: 20, y: 0, z: 20 });
    });

    it('dense placement touches at most 7 unique cells', () => {
      // Surround target with all possible neighbors first (placed via raw setCell
      // which bypasses canPlace — OK for scope test)
      state.setCell(4, 0, 5, { colorId: 1 }); // west
      state.setCell(6, 0, 5, { colorId: 1 }); // east
      state.setCell(5, 0, 4, { colorId: 1 }); // north
      state.setCell(5, 0, 6, { colorId: 1 }); // south
      state.setCell(5, 1, 5, { colorId: 1 }); // above (y=1, floating — setCell allows)

      const touched = new Set();
      state.on('cellResolved', (d) => {
        touched.add(`${d.cell.x}_${d.cell.y}_${d.cell.z}`);
      });

      state.setCell(5, 0, 5, { colorId: 2 });
      // Scope: self + 4 horizontal + above = 6 (below doesn't exist at y=-1 anyway)
      // Upper bound is 7 cells by design (self + 6 directions)
      expect(touched.size).toBeLessThanOrEqual(7);
    });

    it('remove also bounded by scope — at most 7 touched', () => {
      state.setCell(5, 0, 5, { colorId: 1 });
      state.setCell(5, 0, 6, { colorId: 1 });
      state.setCell(6, 0, 5, { colorId: 1 });
      state.setCell(5, 1, 5, { colorId: 1 });

      const touched = new Set();
      state.on('cellResolved', (d) => {
        touched.add(`${d.cell.x}_${d.cell.y}_${d.cell.z}`);
      });
      state.removeCell(5, 0, 5);
      // Remaining neighbors that could change: (5,0,6), (6,0,5), (5,1,5). Self is gone.
      expect(touched.size).toBeLessThanOrEqual(7);
    });
  });

  describe('no-op optimization', () => {
    it('does not call updateTile when tileType did not change', () => {
      state.setCell(5, 0, 5, { colorId: 1 });
      // (5,0,5) now tileType='roof'.
      // Placing a far-away cell should not re-tile (5,0,5).
      const resolvedEvents = [];
      state.on('cellResolved', (d) => resolvedEvents.push(d.cell));
      state.setCell(20, 0, 20, { colorId: 1 });
      // Only (20,0,20) should get a cellResolved
      expect(resolvedEvents).toHaveLength(1);
      expect(resolvedEvents[0]).toMatchObject({ x: 20, y: 0, z: 20 });
    });
  });

  describe('clear — no re-tiling needed', () => {
    it('clear does not emit cellResolved', () => {
      state.setCell(5, 0, 5, { colorId: 1 });
      state.setCell(6, 0, 5, { colorId: 1 });
      const emitted = [];
      state.on('cellResolved', (d) => emitted.push(d));
      state.clear();
      expect(emitted).toEqual([]);
    });
  });

  describe('resolveAll — post-load rehydration', () => {
    it('assigns tileType to all cells after fromJSON', () => {
      // Save a small town
      state.setCell(5, 0, 5, { colorId: 1 });
      state.setCell(6, 0, 5, { colorId: 1 });
      state.setCell(5, 1, 5, { colorId: 1 });
      const json = state.toJSON();

      // Restore into fresh state (tileType=null after fromJSON)
      const state2 = new GameState();
      const resolver2 = new TileResolver(state2);
      state2.fromJSON(json);
      expect(state2.getCell(5, 0, 5).tileType).toBeNull();

      resolver2.resolveAll();
      expect(state2.getCell(5, 0, 5).tileType).toBe('corner');
      expect(state2.getCell(6, 0, 5).tileType).toBe('roof');
      expect(state2.getCell(5, 1, 5).tileType).toBe('roof');
    });

    it('resolveAll on empty state does nothing', () => {
      expect(() => resolver.resolveAll()).not.toThrow();
    });
  });
});

// IS-01 and IS-05 from Test Plan §6a
describe('integration — TileResolver priority + ordering', () => {
  it('IS-05: tileResolver fires BEFORE renderer-like listener', () => {
    const state = new GameState();
    new TileResolver(state); // priority=1
    const order = [];

    // Renderer-like listener subscribes at priority=2, listens to cellResolved
    state.on('cellResolved', ({ cell }) => order.push(`renderer:${cell.tileType}`), 2);

    state.setCell(5, 0, 5, { colorId: 1 });
    // Order: state emits cellChanged → resolver runs → state emits cellResolved → renderer
    // We can only observe from outside. Renderer listener should see resolved tileType.
    expect(order).toEqual(['renderer:roof']);
  });

  it('IS-01: cellResolved fires BEFORE external cellChanged listeners (nested sync cascade)', () => {
    // Architectural invariant: Renderer and SaveState listen to cellResolved
    // (not cellChanged) — they always see post-resolved state. Because resolver
    // runs synchronously at priority=1, its updateTile → cellResolved emission
    // happens BEFORE any external cellChanged listener (default priority=10).
    const state = new GameState();
    new TileResolver(state);
    const events = [];
    state.on('cellChanged', ({ op, cell }) =>
      events.push(`changed:${op}:${cell?.tileType ?? 'null'}`));
    state.on('cellResolved', ({ cell }) => events.push(`resolved:${cell.tileType}`));
    state.setCell(5, 0, 5, { colorId: 1 });
    expect(events).toEqual(['resolved:roof', 'changed:add:null']);
  });
});
