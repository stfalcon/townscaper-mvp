import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveState } from '../src/saveState.js';
import { GameState } from '../src/gameState.js';
import { TileResolver } from '../src/tileResolver.js';
import { STORAGE_KEY } from '../src/constants.js';

function makeStorage() {
  const store = new Map();
  return {
    store,
    getItem: vi.fn((k) => (store.has(k) ? store.get(k) : null)),
    setItem: vi.fn((k, v) => { store.set(k, v); }),
    removeItem: vi.fn((k) => { store.delete(k); }),
  };
}

const KEY = STORAGE_KEY;

describe('SaveState', () => {
  let state, resolver, storage, save;
  beforeEach(() => {
    state = new GameState();
    resolver = new TileResolver(state);
    storage = makeStorage();
    save = new SaveState({ state, resolver, ui: null, storage, debounceMs: 0 });
    save.attach();
  });

  describe('save (AC-F5-01, AC-F5-07)', () => {
    it('save writes versioned JSON with cells (no tileType)', () => {
      state.setCell(5, 1, 5, { colorId: 2 });
      save.flush();
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(storage.store.get(KEY));
      expect(payload.version).toBe('v2');
      expect(payload.cells).toHaveLength(1);
      expect(payload.cells[0]).toMatchObject({ x: 5, y: 1, z: 5, colorId: 2, type: 'building' });
      expect(payload.cells[0].tileType).toBeUndefined(); // AC-F5-07
    });

    it('save includes timestamp', () => {
      save = new SaveState({ state, resolver, ui: null, storage, debounceMs: 0, now: () => 12345 });
      save.attach();
      state.setCell(0, 0, 0, { colorId: 1 });
      save.flush();
      const payload = JSON.parse(storage.store.get(KEY));
      expect(payload.timestamp).toBe(12345);
    });

    it('save includes UI snapshot when ui provided', () => {
      const ui = { getSnapshot: () => ({ selectedColorId: 3, placementsCount: 4, surpriseUnlocked: false }) };
      save = new SaveState({ state, resolver, ui, storage, debounceMs: 0 });
      save.attach();
      state.setCell(0, 0, 0, { colorId: 1 });
      save.flush();
      const payload = JSON.parse(storage.store.get(KEY));
      expect(payload.ui).toEqual({ selectedColorId: 3, placementsCount: 4, surpriseUnlocked: false });
    });
  });

  describe('debounce (AC-F5-04, IS-02)', () => {
    it('rapid setCells collapse into a single save after debounce window', async () => {
      save.detach(); // drop the 0ms instance from beforeEach
      const s = new SaveState({ state, resolver, ui: null, storage, debounceMs: 50 });
      s.attach();
      for (let i = 0; i < 10; i++) state.setCell(i, 0, 0, { colorId: 1 });
      expect(storage.setItem).not.toHaveBeenCalled();
      await new Promise((r) => setTimeout(r, 80));
      expect(storage.setItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('load (AC-F5-02)', () => {
    it('restores cells and re-resolves tileType', () => {
      state.setCell(5, 0, 5, { colorId: 2 });
      state.setCell(6, 0, 5, { colorId: 3 });
      state.setCell(5, 1, 5, { colorId: 4 });
      save.flush();

      // Fresh state — load into it
      const state2 = new GameState();
      const resolver2 = new TileResolver(state2);
      const save2 = new SaveState({ state: state2, resolver: resolver2, ui: null, storage });
      const ok = save2.load();

      expect(ok).toBe(true);
      expect(state2.all()).toHaveLength(3);
      expect(state2.getCell(5, 0, 5).colorId).toBe(2);
      // tileType must be re-derived, not null
      expect(state2.getCell(5, 0, 5).tileType).not.toBeNull();
      expect(state2.getCell(5, 1, 5).tileType).toBe('roof'); // top of stack
    });

    it('restores UI snapshot via ui.restoreSnapshot', () => {
      const ui = {
        getSnapshot: () => ({ selectedColorId: 4, placementsCount: 7, surpriseUnlocked: false }),
        restoreSnapshot: vi.fn(),
      };
      const saveA = new SaveState({ state, resolver, ui, storage, debounceMs: 0 });
      saveA.attach();
      state.setCell(0, 0, 0, { colorId: 1 });
      saveA.flush();

      const state2 = new GameState();
      const resolver2 = new TileResolver(state2);
      const uiB = { restoreSnapshot: vi.fn() };
      const saveB = new SaveState({ state: state2, resolver: resolver2, ui: uiB, storage });
      saveB.load();
      expect(uiB.restoreSnapshot).toHaveBeenCalledWith({
        selectedColorId: 4, placementsCount: 7, surpriseUnlocked: false,
      });
    });

    it('load returns false when nothing is saved', () => {
      expect(save.load()).toBe(false);
    });
  });

  describe('corrupt save (AC-F5-03)', () => {
    it('corrupt JSON is silently cleared; game state untouched', () => {
      storage.store.set(KEY, '{not json');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => save.load()).not.toThrow();
      expect(save.load()).toBe(false);
      expect(storage.store.has(KEY)).toBe(false);
      warn.mockRestore();
    });

    it('non-object JSON (e.g. just "null") returns false without crashing', () => {
      storage.store.set(KEY, 'null');
      expect(save.load()).toBe(false);
    });
  });

  describe('quota exceeded (AC-F5-05)', () => {
    it('setItem throwing QuotaExceededError is caught; save() returns false', () => {
      storage.setItem = vi.fn(() => {
        const err = new Error('Quota');
        err.name = 'QuotaExceededError';
        err.code = 22;
        throw err;
      });
      // Ensure no document dependency in this unit test env
      const createSpy = typeof document === 'undefined'
        ? null
        : vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      state.setCell(0, 0, 0, { colorId: 1 });
      expect(save.flush()).toBe(false);
      createSpy?.mockRestore();
    });

    it('unrelated setItem errors are logged, save() returns false', () => {
      storage.setItem = vi.fn(() => { throw new Error('disk on fire'); });
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      state.setCell(0, 0, 0, { colorId: 1 });
      expect(save.flush()).toBe(false);
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });

  describe('storage unavailable (AC-F5-06)', () => {
    it('null storage → disabled; save/load are safe no-ops', () => {
      const s = new SaveState({ state, resolver, ui: null, storage: null });
      s.attach();
      state.setCell(0, 0, 0, { colorId: 1 });
      expect(s.disabled).toBe(true);
      expect(s.save()).toBe(false);
      expect(s.load()).toBe(false);
      expect(s.flush()).toBe(false);
    });

    it('getItem throwing at load is handled', () => {
      storage.getItem = vi.fn(() => { throw new Error('SecurityError'); });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(save.load()).toBe(false);
      warnSpy.mockRestore();
    });
  });

  describe('pause / resume (for cityGen coming in T-016)', () => {
    it('pause suppresses saves; resume schedules catch-up', async () => {
      save.detach(); // drop the 0ms instance from beforeEach
      const s = new SaveState({ state, resolver, ui: null, storage, debounceMs: 20 });
      s.attach();
      s.pause();
      state.setCell(1, 0, 0, { colorId: 1 });
      state.setCell(2, 0, 0, { colorId: 1 });
      state.setCell(3, 0, 0, { colorId: 1 });
      await new Promise((r) => setTimeout(r, 60));
      expect(storage.setItem).not.toHaveBeenCalled();

      s.resume();
      await new Promise((r) => setTimeout(r, 50));
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(storage.store.get(KEY));
      expect(payload.cells).toHaveLength(3);
    });
  });

  describe('clear', () => {
    it('clear removes the saved entry', () => {
      state.setCell(0, 0, 0, { colorId: 1 });
      save.flush();
      expect(storage.store.has(KEY)).toBe(true);
      save.clear();
      expect(storage.store.has(KEY)).toBe(false);
    });
  });
});
