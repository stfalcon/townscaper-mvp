/**
 * Pure function: derives the visual tile-type of a cell from its 6 neighbors.
 * Rules match TDD §5.1 — full 10-case table covered by tests.
 *
 * Land cells always resolve to 'land' regardless of neighbors — they are
 * a separate visual layer from buildings.
 *
 * @param {object} cell - the cell itself (with type field)
 * @param {{north, south, east, west, above, below}} neighbors
 * @returns {'freestanding' | 'wall' | 'corner' | 'roof' | 'land'}
 */
export function resolveTile(cell, neighbors) {
  if (cell?.type === 'land') return 'land';

  const horizontal =
    (neighbors.north ? 1 : 0) +
    (neighbors.south ? 1 : 0) +
    (neighbors.east ? 1 : 0) +
    (neighbors.west ? 1 : 0);

  // Cells directly above count as 'building' above for roof logic — land
  // below a building does not. But 'above' direction only looks at y+1 which
  // is always a building (land is y=0 only), so no special-case needed here.
  if (!neighbors.above) return 'roof';
  if (horizontal === 0) return 'freestanding';
  if (horizontal === 1) return 'corner';
  return 'wall';
}
