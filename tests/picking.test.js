import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { pickWithDDA } from '../src/picking.js';
import { GameState } from '../src/gameState.js';
import { GRID_SIZE } from '../src/constants.js';

/**
 * Builds a ray from a world-space origin pointing toward a world target.
 */
function rayFromTo(origin, target) {
  const dir = new THREE.Vector3().subVectors(target, origin).normalize();
  return new THREE.Ray(origin.clone(), dir);
}

describe('pickWithDDA — voxel traversal (AC: NF-1.10, T-006 DoD)', () => {
  let state;
  beforeEach(() => { state = new GameState(); });

  describe('empty grid — ray falls to ground plane', () => {
    it('ray pointing straight down hits ground at integer coord', () => {
      const origin = new THREE.Vector3(10.5, 20, 10.5);
      const ray = new THREE.Ray(origin, new THREE.Vector3(0, -1, 0));
      const hit = pickWithDDA(ray, state);
      expect(hit).not.toBeNull();
      expect(hit.hitCell).toBeNull();
      expect(hit.placementCoord).toEqual({ x: 10, y: 0, z: 10 });
    });

    it('diagonal ray from NE hits ground at correct coord', () => {
      const origin = new THREE.Vector3(25, 30, 25);
      const target = new THREE.Vector3(15, 0, 15);
      const ray = rayFromTo(origin, target);
      const hit = pickWithDDA(ray, state);
      expect(hit).not.toBeNull();
      expect(hit.hitCell).toBeNull();
      expect(hit.placementCoord).toEqual({ x: 15, y: 0, z: 15 });
    });

    it('ray missing grid returns null', () => {
      // Ray above grid, going upward — never hits ground
      const origin = new THREE.Vector3(15, 50, 15);
      const ray = new THREE.Ray(origin, new THREE.Vector3(0, 1, 0));
      expect(pickWithDDA(ray, state)).toBeNull();
    });

    it('ray hitting ground outside grid bounds returns null', () => {
      const origin = new THREE.Vector3(100, 20, 100);
      const ray = new THREE.Ray(origin, new THREE.Vector3(0, -1, 0));
      expect(pickWithDDA(ray, state)).toBeNull();
    });
  });

  describe('ray hits existing cell', () => {
    it('straight-down ray onto cube → hit cell, placement above', () => {
      state.setCell(10, 0, 10, { colorId: 1 });
      const origin = new THREE.Vector3(10.5, 20, 10.5);
      const ray = new THREE.Ray(origin, new THREE.Vector3(0, -1, 0));
      const hit = pickWithDDA(ray, state);
      expect(hit.hitCell).toMatchObject({ x: 10, y: 0, z: 10 });
      expect(hit.placementCoord).toEqual({ x: 10, y: 1, z: 10 });
      expect(hit.face).toEqual({ axis: 'y', dir: 1 }); // entered top face
    });

    it('tower — ray hits topmost cell first', () => {
      state.setCell(5, 0, 5, { colorId: 1 });
      state.setCell(5, 1, 5, { colorId: 1 });
      state.setCell(5, 2, 5, { colorId: 1 });
      const origin = new THREE.Vector3(5.5, 20, 5.5);
      const ray = new THREE.Ray(origin, new THREE.Vector3(0, -1, 0));
      const hit = pickWithDDA(ray, state);
      expect(hit.hitCell.y).toBe(2);
      expect(hit.placementCoord).toEqual({ x: 5, y: 3, z: 5 });
    });

    it('diagonal hit — placement on adjacent face', () => {
      state.setCell(10, 0, 10, { colorId: 1 });
      // Ray coming from east+above, hitting east face of cube at (10,0,10)
      const origin = new THREE.Vector3(13, 3, 10.5);
      const target = new THREE.Vector3(10.5, 0.5, 10.5);
      const ray = rayFromTo(origin, target);
      const hit = pickWithDDA(ray, state);
      expect(hit.hitCell).toMatchObject({ x: 10, y: 0, z: 10 });
      // Depending on ray angle, placement is either above or east (11,0,10)
      expect(hit.placementCoord).not.toBeNull();
      const { x, y, z } = hit.placementCoord;
      // Must be adjacent to (10,0,10)
      const dx = Math.abs(x - 10), dy = Math.abs(y - 0), dz = Math.abs(z - 10);
      expect(dx + dy + dz).toBe(1);
    });
  });

  describe('robustness', () => {
    it('handles ray parallel to ground (no y movement)', () => {
      const origin = new THREE.Vector3(5, 0.5, 5);
      const ray = new THREE.Ray(origin, new THREE.Vector3(1, 0, 0));
      // Should not hang or crash; returns null or ground (edge case)
      expect(() => pickWithDDA(ray, state)).not.toThrow();
    });

    it('handles ray originating inside an occupied cell', () => {
      state.setCell(5, 0, 5, { colorId: 1 });
      const origin = new THREE.Vector3(5.5, 0.5, 5.5); // inside the cube
      const ray = new THREE.Ray(origin, new THREE.Vector3(1, 0, 0));
      const hit = pickWithDDA(ray, state);
      expect(hit.hitCell).toMatchObject({ x: 5, y: 0, z: 5 });
    });

    it('performance: 1000 random rays on 500-cell grid completes quickly', () => {
      // Fill grid
      for (let i = 0; i < 500; i++) {
        state.setCell(i % GRID_SIZE, 0, Math.floor(i / GRID_SIZE) % GRID_SIZE, { colorId: 1 });
      }
      const t0 = performance.now();
      for (let i = 0; i < 1000; i++) {
        const origin = new THREE.Vector3(
          Math.random() * GRID_SIZE,
          30,
          Math.random() * GRID_SIZE,
        );
        const ray = new THREE.Ray(origin, new THREE.Vector3(0, -1, 0));
        pickWithDDA(ray, state);
      }
      const elapsedPerCall = (performance.now() - t0) / 1000;
      // NF-1.10: <0.2ms per pick. Allow 3x margin for CI noise → <0.6ms
      expect(elapsedPerCall).toBeLessThan(0.6);
    });
  });
});
