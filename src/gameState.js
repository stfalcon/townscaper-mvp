import { GRID_SIZE, MAX_HEIGHT, MAX_CELLS, LAND_COLOR_ID } from './constants.js';

const EVENTS = ['cellChanged', 'cellResolved', 'loaded'];

export class GameState {
  #cells = new Map();
  #listeners = { cellChanged: [], cellResolved: [], loaded: [] };

  #key(x, y, z) {
    return `${x}_${y}_${z}`;
  }

  #has(x, y, z) {
    return this.#cells.has(this.#key(x, y, z));
  }

  getCell(x, y, z) {
    return this.#cells.get(this.#key(x, y, z)) ?? null;
  }

  canPlace(x, y, z, type = 'building') {
    if (x < 0 || x >= GRID_SIZE || z < 0 || z >= GRID_SIZE) {
      return { ok: false, reason: 'out-of-bounds' };
    }
    if (y < 0 || y >= MAX_HEIGHT) {
      return { ok: false, reason: 'too-high' };
    }
    if (this.#has(x, y, z)) {
      return { ok: false, reason: 'occupied' };
    }
    if (this.#cells.size >= MAX_CELLS) {
      return { ok: false, reason: 'too-many' };
    }
    if (type === 'land') {
      // Land only at water level (y=0). No support required — islands may seed
      // anywhere on water.
      if (y !== 0) return { ok: false, reason: 'land-y-must-be-zero' };
      return { ok: true };
    }
    // building:
    // Must sit on something — land or another building, directly below or to
    // the side at the same y. Floating at y=0 is not allowed: water has no
    // structural support, so buildings require land first.
    if (y === 0) return { ok: false, reason: 'building-needs-land' };
    const hasSupport =
      this.#has(x, y - 1, z) ||
      this.#has(x - 1, y, z) || this.#has(x + 1, y, z) ||
      this.#has(x, y, z - 1) || this.#has(x, y, z + 1);
    if (!hasSupport) return { ok: false, reason: 'no-support' };
    return { ok: true };
  }

  setCell(x, y, z, { colorId, type = 'building' }) {
    const effectiveColorId = type === 'land' ? LAND_COLOR_ID : colorId;
    const cell = Object.freeze({ x, y, z, colorId: effectiveColorId, type, tileType: null });
    this.#cells.set(this.#key(x, y, z), cell);
    this.#emit('cellChanged', { op: 'add', cell });
    return cell;
  }

  removeCell(x, y, z) {
    const k = this.#key(x, y, z);
    const cell = this.#cells.get(k);
    if (!cell) return null;
    this.#cells.delete(k);
    this.#emit('cellChanged', { op: 'remove', cell });
    return cell;
  }

  updateTile(x, y, z, tileType) {
    const k = this.#key(x, y, z);
    const prev = this.#cells.get(k);
    if (!prev) return null;
    const next = Object.freeze({ ...prev, tileType });
    this.#cells.set(k, next);
    this.#emit('cellResolved', { cell: next });
    return next;
  }

  getNeighbors(x, y, z) {
    return {
      north: this.getCell(x, y, z - 1),
      south: this.getCell(x, y, z + 1),
      east: this.getCell(x + 1, y, z),
      west: this.getCell(x - 1, y, z),
      above: this.getCell(x, y + 1, z),
      below: this.getCell(x, y - 1, z),
    };
  }

  all() {
    return Array.from(this.#cells.values());
  }

  clear() {
    const count = this.#cells.size;
    this.#cells.clear();
    this.#emit('cellChanged', { op: 'clear', count });
  }

  toJSON() {
    return {
      version: 'v2',
      cells: this.all().map(({ x, y, z, colorId, type }) => ({ x, y, z, colorId, type })),
    };
  }

  fromJSON(data) {
    this.#cells.clear();
    const cells = data?.cells;
    if (!Array.isArray(cells)) {
      this.#emit('loaded', { count: 0 });
      return;
    }
    for (const c of cells) {
      if (typeof c?.x !== 'number') continue;
      const type = c.type === 'land' ? 'land' : 'building';
      const colorId = type === 'land' ? LAND_COLOR_ID : c.colorId;
      const cell = Object.freeze({
        x: c.x, y: c.y, z: c.z, colorId, type, tileType: null,
      });
      this.#cells.set(this.#key(c.x, c.y, c.z), cell);
    }
    this.#emit('loaded', { count: this.#cells.size });
  }

  on(event, fn, priority = 10) {
    if (!EVENTS.includes(event)) {
      throw new Error(`Unknown event: ${event}. Expected one of ${EVENTS.join(', ')}`);
    }
    this.#listeners[event].push({ fn, priority });
    this.#listeners[event].sort((a, b) => a.priority - b.priority);
  }

  off(event, fn) {
    if (!EVENTS.includes(event)) return;
    this.#listeners[event] = this.#listeners[event].filter((l) => l.fn !== fn);
  }

  #emit(event, detail) {
    for (const { fn } of this.#listeners[event]) fn(detail);
  }
}
