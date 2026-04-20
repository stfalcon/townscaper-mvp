import { resolveTile } from './tileLogic.js';

/**
 * Orchestrates re-tiling as cells change.
 *
 * Subscribes to `state.cellChanged` at priority=1 so it runs BEFORE any
 * Renderer / SaveState listeners. For each change it recomputes `tileType`
 * for the affected cell + up to 6 neighbors, then writes via `state.updateTile`
 * which fires `cellResolved` — the event Renderer/SaveState should actually
 * listen to.
 *
 * Only emits `cellResolved` when tileType actually changes (no-op optimization).
 */
export class TileResolver {
  constructor(state) {
    this.state = state;
    state.on('cellChanged', this.#onChange.bind(this), 1);
  }

  #onChange({ op, cell }) {
    if (op === 'clear') return;
    for (const c of this.#scope(cell)) {
      const tileType = resolveTile(c, this.state.getNeighbors(c.x, c.y, c.z));
      if (c.tileType !== tileType) {
        this.state.updateTile(c.x, c.y, c.z, tileType);
      }
    }
  }

  /**
   * Returns the cells within the re-tile scope of `cell`:
   * the cell itself (if still present) + its 6 directional neighbors.
   * At most 7 cells — scope bound asserted by AC-F3-03.
   */
  #scope(cell) {
    const { x, y, z } = cell;
    const coords = [
      [x, y, z],
      [x, y, z - 1], [x, y, z + 1],
      [x - 1, y, z], [x + 1, y, z],
      [x, y - 1, z], [x, y + 1, z],
    ];
    return coords
      .map(([cx, cy, cz]) => this.state.getCell(cx, cy, cz))
      .filter(Boolean);
  }

  /**
   * Re-resolves tileType for every cell in the state. Called after
   * `fromJSON` (load) since tileType is not persisted.
   */
  resolveAll() {
    for (const c of this.state.all()) {
      const tileType = resolveTile(c, this.state.getNeighbors(c.x, c.y, c.z));
      if (c.tileType !== tileType) {
        this.state.updateTile(c.x, c.y, c.z, tileType);
      }
    }
  }
}
