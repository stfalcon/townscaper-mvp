import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../src/gameState.js';
import { GRID_SIZE, MAX_HEIGHT, MAX_CELLS } from '../src/constants.js';

describe('GameState', () => {
  let state;
  beforeEach(() => {
    state = new GameState();
  });

  describe('getCell / setCell / removeCell', () => {
    it('returns null for empty cell', () => {
      expect(state.getCell(5, 0, 5)).toBeNull();
    });

    it('setCell creates a cell and returns it', () => {
      const cell = state.setCell(5, 0, 5, { colorId: 2 });
      expect(cell).toMatchObject({ x: 5, y: 0, z: 5, colorId: 2, tileType: null });
    });

    it('setCell stores cell — getCell retrieves it', () => {
      state.setCell(5, 0, 5, { colorId: 2 });
      expect(state.getCell(5, 0, 5)).toMatchObject({ x: 5, y: 0, z: 5, colorId: 2 });
    });

    it('setCell on existing coord overwrites', () => {
      state.setCell(5, 0, 5, { colorId: 1 });
      state.setCell(5, 0, 5, { colorId: 3 });
      expect(state.getCell(5, 0, 5).colorId).toBe(3);
    });

    it('removeCell returns the removed cell', () => {
      state.setCell(5, 0, 5, { colorId: 2 });
      const removed = state.removeCell(5, 0, 5);
      expect(removed.colorId).toBe(2);
    });

    it('removeCell on missing coord returns null, does not throw', () => {
      expect(state.removeCell(1, 1, 1)).toBeNull();
    });

    it('cells are immutable (frozen)', () => {
      const cell = state.setCell(5, 0, 5, { colorId: 2 });
      expect(Object.isFrozen(cell)).toBe(true);
    });
  });

  describe('canPlace', () => {
    it('ok=true for empty ground cell in bounds', () => {
      expect(state.canPlace(5, 0, 5)).toEqual({ ok: true });
    });

    it.each([
      [-1, 0, 5, 'out-of-bounds'],
      [GRID_SIZE, 0, 5, 'out-of-bounds'],
      [5, 0, -1, 'out-of-bounds'],
      [5, 0, GRID_SIZE, 'out-of-bounds'],
    ])('rejects out-of-bounds (%i, %i, %i)', (x, y, z, reason) => {
      expect(state.canPlace(x, y, z)).toEqual({ ok: false, reason });
    });

    it.each([
      [5, -1, 5, 'too-high'],
      [5, MAX_HEIGHT, 5, 'too-high'],
    ])('rejects too-high (%i, %i, %i)', (x, y, z, reason) => {
      expect(state.canPlace(x, y, z)).toEqual({ ok: false, reason });
    });

    it('rejects occupied cell', () => {
      state.setCell(5, 0, 5, { colorId: 1 });
      expect(state.canPlace(5, 0, 5)).toEqual({ ok: false, reason: 'occupied' });
    });

    it('rejects when MAX_CELLS reached', () => {
      // Fill the state to the cap (brute — but MAX_CELLS is 2500, fast enough)
      let placed = 0;
      outer: for (let y = 0; y < MAX_HEIGHT; y++) {
        for (let z = 0; z < GRID_SIZE; z++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            if (placed >= MAX_CELLS) break outer;
            state.setCell(x, y, z, { colorId: 1 });
            placed++;
          }
        }
      }
      expect(placed).toBe(MAX_CELLS);
      // Find an empty coord to try (y=2 z=25 x=25 likely empty since MAX_CELLS=2500 < 9000)
      const emptyCoord = [25, 2, 25];
      if (!state.getCell(...emptyCoord)) {
        expect(state.canPlace(...emptyCoord)).toEqual({ ok: false, reason: 'too-many' });
      }
    });

    it('rejects floating cell (y>0 without support)', () => {
      // AC-F1-07
      expect(state.canPlace(5, 5, 5)).toEqual({ ok: false, reason: 'no-support' });
    });

    it('accepts y>0 with support from below', () => {
      state.setCell(5, 0, 5, { colorId: 1 });
      expect(state.canPlace(5, 1, 5)).toEqual({ ok: true });
    });

    it.each([
      [[4, 1, 5], [5, 1, 5]],  // support from west
      [[6, 1, 5], [5, 1, 5]],  // support from east
      [[5, 1, 4], [5, 1, 5]],  // support from north
      [[5, 1, 6], [5, 1, 5]],  // support from south
    ])('accepts y>0 with horizontal neighbor support', (support, target) => {
      state.setCell(...support, { colorId: 1 });
      expect(state.canPlace(...target)).toEqual({ ok: true });
    });

    it('rejects y=MAX_HEIGHT (AC-F1-06)', () => {
      // Build tower up to the top
      for (let y = 0; y < MAX_HEIGHT; y++) {
        state.setCell(5, y, 5, { colorId: 1 });
      }
      // placing at y=MAX_HEIGHT must fail
      expect(state.canPlace(5, MAX_HEIGHT, 5)).toEqual({ ok: false, reason: 'too-high' });
    });
  });

  describe('updateTile', () => {
    it('updates tileType on existing cell', () => {
      state.setCell(5, 0, 5, { colorId: 2 });
      const updated = state.updateTile(5, 0, 5, 'wall');
      expect(updated.tileType).toBe('wall');
      expect(state.getCell(5, 0, 5).tileType).toBe('wall');
    });

    it('preserves colorId when updating tileType', () => {
      state.setCell(5, 0, 5, { colorId: 3 });
      state.updateTile(5, 0, 5, 'corner');
      expect(state.getCell(5, 0, 5).colorId).toBe(3);
    });

    it('returns null on missing cell', () => {
      expect(state.updateTile(5, 0, 5, 'wall')).toBeNull();
    });

    it('creates new frozen object (immutability)', () => {
      const original = state.setCell(5, 0, 5, { colorId: 2 });
      const updated = state.updateTile(5, 0, 5, 'wall');
      expect(updated).not.toBe(original);
      expect(Object.isFrozen(updated)).toBe(true);
    });
  });

  describe('getNeighbors', () => {
    it('returns 6 directions with null for empty', () => {
      const n = state.getNeighbors(5, 0, 5);
      expect(n).toEqual({
        north: null, south: null, east: null, west: null, above: null, below: null,
      });
    });

    it('finds populated neighbors correctly', () => {
      state.setCell(5, 0, 4, { colorId: 1 }); // north
      state.setCell(5, 0, 6, { colorId: 2 }); // south
      state.setCell(6, 0, 5, { colorId: 3 }); // east
      state.setCell(4, 0, 5, { colorId: 4 }); // west
      state.setCell(5, 1, 5, { colorId: 5 }); // above

      const n = state.getNeighbors(5, 0, 5);
      expect(n.north.colorId).toBe(1);
      expect(n.south.colorId).toBe(2);
      expect(n.east.colorId).toBe(3);
      expect(n.west.colorId).toBe(4);
      expect(n.above.colorId).toBe(5);
      expect(n.below).toBeNull();
    });
  });

  describe('all / clear', () => {
    it('all() returns empty array initially', () => {
      expect(state.all()).toEqual([]);
    });

    it('all() returns cells after setting', () => {
      state.setCell(1, 0, 1, { colorId: 1 });
      state.setCell(2, 0, 2, { colorId: 2 });
      expect(state.all()).toHaveLength(2);
    });

    it('clear removes all cells', () => {
      state.setCell(1, 0, 1, { colorId: 1 });
      state.setCell(2, 0, 2, { colorId: 2 });
      state.clear();
      expect(state.all()).toEqual([]);
    });
  });

  describe('toJSON / fromJSON', () => {
    it('toJSON has version v1', () => {
      expect(state.toJSON().version).toBe('v1');
    });

    it('toJSON excludes tileType (derived, not persisted)', () => {
      state.setCell(5, 0, 5, { colorId: 2 });
      state.updateTile(5, 0, 5, 'roof');
      const json = state.toJSON();
      expect(json.cells[0]).toEqual({ x: 5, y: 0, z: 5, colorId: 2 });
      expect(json.cells[0].tileType).toBeUndefined();
    });

    it('fromJSON restores cells with null tileType', () => {
      state.setCell(1, 0, 1, { colorId: 1 });
      state.setCell(2, 0, 2, { colorId: 2 });
      const serialized = state.toJSON();

      const state2 = new GameState();
      state2.fromJSON(serialized);
      expect(state2.all()).toHaveLength(2);
      expect(state2.getCell(1, 0, 1).colorId).toBe(1);
      expect(state2.getCell(1, 0, 1).tileType).toBeNull();
    });

    it('fromJSON clears existing cells first', () => {
      state.setCell(0, 0, 0, { colorId: 1 });
      state.fromJSON({ version: 'v1', cells: [{ x: 5, y: 0, z: 5, colorId: 2 }] });
      expect(state.getCell(0, 0, 0)).toBeNull();
      expect(state.getCell(5, 0, 5).colorId).toBe(2);
    });

    it('fromJSON is tolerant to malformed data', () => {
      expect(() => state.fromJSON(null)).not.toThrow();
      expect(() => state.fromJSON({})).not.toThrow();
      expect(() => state.fromJSON({ cells: null })).not.toThrow();
      expect(state.all()).toEqual([]);
    });
  });

  describe('events: priority-based bus', () => {
    it('emits cellChanged op=add on setCell', () => {
      const fn = vi.fn();
      state.on('cellChanged', fn);
      state.setCell(5, 0, 5, { colorId: 1 });
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0]).toMatchObject({ op: 'add', cell: { x: 5, y: 0, z: 5 } });
    });

    it('emits cellChanged op=remove on removeCell', () => {
      state.setCell(5, 0, 5, { colorId: 1 });
      const fn = vi.fn();
      state.on('cellChanged', fn);
      state.removeCell(5, 0, 5);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0].op).toBe('remove');
    });

    it('does not emit on removeCell when nothing to remove', () => {
      const fn = vi.fn();
      state.on('cellChanged', fn);
      state.removeCell(5, 0, 5);
      expect(fn).not.toHaveBeenCalled();
    });

    it('emits cellChanged op=clear', () => {
      const fn = vi.fn();
      state.on('cellChanged', fn);
      state.clear();
      expect(fn).toHaveBeenCalledWith({ op: 'clear', count: 0 });
    });

    it('emits cellResolved on updateTile', () => {
      state.setCell(5, 0, 5, { colorId: 1 });
      const fn = vi.fn();
      state.on('cellResolved', fn);
      state.updateTile(5, 0, 5, 'wall');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0].cell.tileType).toBe('wall');
    });

    it('emits loaded after fromJSON', () => {
      const fn = vi.fn();
      state.on('loaded', fn);
      state.fromJSON({ version: 'v1', cells: [{ x: 1, y: 0, z: 1, colorId: 1 }] });
      expect(fn).toHaveBeenCalledWith({ count: 1 });
    });

    it('listeners fire in priority order (lower first)', () => {
      const order = [];
      state.on('cellChanged', () => order.push('c'), 3);
      state.on('cellChanged', () => order.push('a'), 1);
      state.on('cellChanged', () => order.push('b'), 2);
      state.setCell(1, 0, 1, { colorId: 1 });
      expect(order).toEqual(['a', 'b', 'c']);
    });

    it('off removes a listener', () => {
      const fn = vi.fn();
      state.on('cellChanged', fn);
      state.off('cellChanged', fn);
      state.setCell(1, 0, 1, { colorId: 1 });
      expect(fn).not.toHaveBeenCalled();
    });

    it('on with unknown event throws', () => {
      expect(() => state.on('fakeEvent', () => {})).toThrow(/Unknown event/);
    });
  });
});
