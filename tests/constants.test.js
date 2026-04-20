import { describe, it, expect } from 'vitest';
import {
  GRID_SIZE, MAX_HEIGHT, MAX_CELLS, CELL_SIZE,
  COLORS, TILE_TYPES, ANIM, CLICK_THRESHOLD,
  CAMERA, PALETTE, STORAGE_KEY,
} from '../src/constants.js';

describe('constants', () => {
  it('grid dimensions are correct', () => {
    expect(GRID_SIZE).toBe(30);
    expect(MAX_HEIGHT).toBe(10);
    expect(MAX_CELLS).toBe(2500);
    expect(CELL_SIZE).toBe(1.0);
  });

  it('COLORS has 6 entries with correct shape', () => {
    expect(COLORS).toHaveLength(6);
    for (const c of COLORS) {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('hex');
      expect(c).toHaveProperty('name');
      expect(typeof c.hex).toBe('number');
    }
  });

  it('6th color is Surprise, unlocked after 10 placements', () => {
    expect(COLORS[5].name).toBe('Surprise');
    expect(COLORS[5].unlockAfter).toBe(10);
  });

  it('TILE_TYPES covers 4 variants from TDD §5.1', () => {
    expect(TILE_TYPES).toEqual(['freestanding', 'wall', 'corner', 'roof']);
  });

  it('ANIM has all required durations', () => {
    expect(ANIM.place).toBe(250);
    expect(ANIM.remove).toBe(150);
    expect(ANIM.holdConfirm).toBe(1500);
  });

  it('CLICK_THRESHOLD matches GDD drag-vs-click spec', () => {
    expect(CLICK_THRESHOLD.maxDistance).toBe(8);
    expect(CLICK_THRESHOLD.maxDuration).toBe(300);
  });

  it('CAMERA uses dimetric 30° pitch', () => {
    expect(CAMERA.pitch).toBeCloseTo(Math.PI / 6, 5);
    expect(CAMERA.yaw).toBeCloseTo(Math.PI / 4, 5);
  });

  it('PALETTE has required world colors', () => {
    expect(PALETTE.grass).toBe(0xB8D49A);
    expect(PALETTE.skyTop).toBe(0xC8E0ED);
  });

  it('STORAGE_KEY is versioned', () => {
    expect(STORAGE_KEY).toMatch(/^townscaper-mvp-v\d+$/);
  });
});
