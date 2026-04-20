/**
 * Pure function: derives the visual tile-type of a cell from its 6 neighbors.
 * Rules match TDD §5.1 — full 10-case table covered by tests.
 *
 * @param {object} cell - the cell itself (unused; kept for future signature)
 * @param {{north, south, east, west, above, below}} neighbors
 * @returns {'freestanding' | 'wall' | 'corner' | 'roof'}
 */
export function resolveTile(cell, neighbors) {
  const horizontal =
    (neighbors.north ? 1 : 0) +
    (neighbors.south ? 1 : 0) +
    (neighbors.east ? 1 : 0) +
    (neighbors.west ? 1 : 0);

  if (!neighbors.above) return 'roof';
  if (horizontal === 0) return 'freestanding';
  if (horizontal === 1) return 'corner';
  return 'wall';
}
