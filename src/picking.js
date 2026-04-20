import * as THREE from 'three';
import { GRID_SIZE, MAX_HEIGHT } from './constants.js';

const MAX_DDA_STEPS = 500;
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _tmpVec = new THREE.Vector3();

/**
 * Amanatides-Woo 3D DDA voxel traversal (TDD §5.2).
 *
 * Walks the ray one voxel at a time, checking state.getCell(). Returns the
 * first occupied voxel encountered, with the empty voxel preceding it as
 * placementCoord + the face the ray entered through.
 *
 * If the ray exits the grid without hitting any cell, falls through to the
 * ground plane at y=0 and returns that as the placement coord.
 *
 * O(max ray length in voxels), independent of cell count.
 *
 * @param {THREE.Ray} ray
 * @param {{getCell(x,y,z): object|null}} state
 * @returns {null | { hitCell, placementCoord, face }}
 */
export function pickWithDDA(ray, state) {
  const { origin, direction: dir } = ray;

  const step = {
    x: dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0,
    y: dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0,
    z: dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0,
  };

  const voxel = {
    x: Math.floor(origin.x),
    y: Math.floor(origin.y),
    z: Math.floor(origin.z),
  };

  const tDelta = {
    x: step.x !== 0 ? Math.abs(1 / dir.x) : Infinity,
    y: step.y !== 0 ? Math.abs(1 / dir.y) : Infinity,
    z: step.z !== 0 ? Math.abs(1 / dir.z) : Infinity,
  };

  const tMax = {
    x: step.x === 0 ? Infinity
      : ((step.x > 0 ? voxel.x + 1 : voxel.x) - origin.x) / dir.x,
    y: step.y === 0 ? Infinity
      : ((step.y > 0 ? voxel.y + 1 : voxel.y) - origin.y) / dir.y,
    z: step.z === 0 ? Infinity
      : ((step.z > 0 ? voxel.z + 1 : voxel.z) - origin.z) / dir.z,
  };

  let lastEmpty = null;
  let hitFace = null;

  for (let i = 0; i < MAX_DDA_STEPS; i++) {
    // Evaluate current voxel only if inside grid
    const inside =
      voxel.x >= 0 && voxel.x < GRID_SIZE &&
      voxel.y >= 0 && voxel.y < MAX_HEIGHT &&
      voxel.z >= 0 && voxel.z < GRID_SIZE;
    if (inside) {
      const cell = state.getCell(voxel.x, voxel.y, voxel.z);
      if (cell) {
        return {
          hitCell: cell,
          placementCoord: lastEmpty,
          face: hitFace,
        };
      }
      lastEmpty = { x: voxel.x, y: voxel.y, z: voxel.z };
    }

    // Step to next voxel
    if (tMax.x < tMax.y && tMax.x < tMax.z) {
      voxel.x += step.x;
      tMax.x += tDelta.x;
      hitFace = { axis: 'x', dir: -step.x };
    } else if (tMax.y < tMax.z) {
      voxel.y += step.y;
      tMax.y += tDelta.y;
      hitFace = { axis: 'y', dir: -step.y };
    } else {
      voxel.z += step.z;
      tMax.z += tDelta.z;
      hitFace = { axis: 'z', dir: -step.z };
    }

    // Exit if we've left the grid vertically — no chance of finding cells
    if ((voxel.y < 0 && step.y <= 0) || (voxel.y >= MAX_HEIGHT && step.y >= 0)) break;
  }

  // No cell — fall to ground plane
  const hit = ray.intersectPlane(GROUND_PLANE, _tmpVec);
  if (!hit) return null;
  const gx = Math.floor(hit.x);
  const gz = Math.floor(hit.z);
  if (gx < 0 || gx >= GRID_SIZE || gz < 0 || gz >= GRID_SIZE) return null;
  return {
    hitCell: null,
    placementCoord: { x: gx, y: 0, z: gz },
    face: { axis: 'y', dir: -1 },
  };
}
