import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../src/gameState.js';
import { GRID_SIZE, MAX_HEIGHT, MAX_CELLS, LAND_COLOR_ID } from '../src/constants.js';

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
    describe('land (type="land")', () => {
      it('ok=true for empty y=0 cell in bounds', () => {
        expect(state.canPlace(5, 0, 5, 'land')).toEqual({ ok: true });
      });

      it('rejects land at y>0', () => {
        expect(state.canPlace(5, 1, 5, 'land')).toEqual({ ok: false, reason: 'land-y-must-be-zero' });
      });

      it('first land cell seeds anywhere (no support required)', () => {
        expect(state.canPlace(10, 0, 10, 'land')).toEqual({ ok: true });
      });

      it('second land must connect to existing land (orthogonally)', () => {
        state.setCell(10, 0, 10, { type: 'land' });
        // Disjoint — rejected.
        expect(state.canPlace(20, 0, 20, 'land'))
          .toEqual({ ok: false, reason: 'land-not-connected' });
        // Adjacent — accepted.
        expect(state.canPlace(11, 0, 10, 'land')).toEqual({ ok: true });
        expect(state.canPlace(10, 0, 11, 'land')).toEqual({ ok: true });
      });

      it('diagonal adjacency does not count (must be orthogonal)', () => {
        state.setCell(10, 0, 10, { type: 'land' });
        expect(state.canPlace(11, 0, 11, 'land'))
          .toEqual({ ok: false, reason: 'land-not-connected' });
      });

      it('buildings do not satisfy land neighbor requirement', () => {
        state.setCell(10, 0, 10, { type: 'land' });
        state.setCell(10, 1, 10, { colorId: 1, type: 'building' });
        // Building at (10,1,10) sits above the single seed — the neighbor
        // check at y=0 still looks for land at (11,0,10) etc., not buildings.
        expect(state.canPlace(12, 0, 10, 'land'))
          .toEqual({ ok: false, reason: 'land-not-connected' });
      });

      it('rejects occupied land cell', () => {
        state.setCell(5, 0, 5, { type: 'land' });
        expect(state.canPlace(5, 0, 5, 'land')).toEqual({ ok: false, reason: 'occupied' });
      });
    });

    describe('building (default type)', () => {
      it('rejects building at y=0 (needs land first)', () => {
        expect(state.canPlace(5, 0, 5)).toEqual({ ok: false, reason: 'building-needs-land' });
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
        state.setCell(5, 1, 5, { colorId: 1 });
        expect(state.canPlace(5, 1, 5)).toEqual({ ok: false, reason: 'occupied' });
      });

      it('rejects when MAX_CELLS reached', () => {
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
        const emptyCoord = [25, 2, 25];
        if (!state.getCell(...emptyCoord)) {
          expect(state.canPlace(...emptyCoord)).toEqual({ ok: false, reason: 'too-many' });
        }
      });

      it('rejects floating cell (y>0 without support)', () => {
        expect(state.canPlace(5, 5, 5)).toEqual({ ok: false, reason: 'no-support' });
      });

      it('accepts y=1 with land below (support from below)', () => {
        state.setCell(5, 0, 5, { type: 'land' });
        expect(state.canPlace(5, 1, 5)).toEqual({ ok: true });
      });

      it.each([
        [[4, 1, 5], [5, 1, 5]],
        [[6, 1, 5], [5, 1, 5]],
        [[5, 1, 4], [5, 1, 5]],
        [[5, 1, 6], [5, 1, 5]],
      ])('accepts y>0 with horizontal neighbor support', (support, target) => {
        state.setCell(...support, { colorId: 1 });
        expect(state.canPlace(...target)).toEqual({ ok: true });
      });

      it('rejects y=MAX_HEIGHT (AC-F1-06)', () => {
        state.setCell(5, 0, 5, { type: 'land' });
        for (let y = 1; y < MAX_HEIGHT; y++) {
          state.setCell(5, y, 5, { colorId: 1 });
        }
        expect(state.canPlace(5, MAX_HEIGHT, 5)).toEqual({ ok: false, reason: 'too-high' });
      });
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
    it('toJSON has version v2', () => {
      expect(state.toJSON().version).toBe('v2');
    });

    it('toJSON excludes tileType (derived, not persisted) but includes type', () => {
      state.setCell(5, 0, 5, { type: 'land' });
      state.updateTile(5, 0, 5, 'land');
      const json = state.toJSON();
      expect(json.cells[0]).toEqual({ x: 5, y: 0, z: 5, colorId: LAND_COLOR_ID, type: 'land' });
      expect(json.cells[0].tileType).toBeUndefined();
    });

    it('fromJSON restores cells with null tileType and preserves type', () => {
      state.setCell(1, 0, 1, { type: 'land' });
      state.setCell(1, 1, 1, { colorId: 2 });
      const serialized = state.toJSON();

      const state2 = new GameState();
      state2.fromJSON(serialized);
      expect(state2.all()).toHaveLength(2);
      expect(state2.getCell(1, 0, 1).type).toBe('land');
      expect(state2.getCell(1, 1, 1).type).toBe('building');
      expect(state2.getCell(1, 0, 1).tileType).toBeNull();
    });

    it('fromJSON clears existing cells first', () => {
      state.setCell(0, 0, 0, { type: 'land' });
      state.fromJSON({ version: 'v2', cells: [{ x: 5, y: 0, z: 5, colorId: 2, type: 'land' }] });
      expect(state.getCell(0, 0, 0)).toBeNull();
      expect(state.getCell(5, 0, 5).type).toBe('land');
    });

    it('fromJSON treats cells without "type" field as buildings (legacy tolerant)', () => {
      state.fromJSON({ version: 'v1', cells: [{ x: 5, y: 0, z: 5, colorId: 2 }] });
      expect(state.getCell(5, 0, 5).type).toBe('building');
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
      state.fromJSON({ version: 'v2', cells: [{ x: 1, y: 0, z: 1, colorId: 1, type: 'land' }] });
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
