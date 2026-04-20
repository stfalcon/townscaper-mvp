import { test, expect } from '@playwright/test';

test('T-003: tileLogic pure function works in browser', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { resolveTile } = await import('/src/tileLogic.js');
    const mkN = (horizontal, hasAbove) => {
      const dirs = ['north', 'south', 'east', 'west'];
      const n = { north: null, south: null, east: null, west: null, above: null, below: null };
      for (let i = 0; i < horizontal; i++) n[dirs[i]] = { x: 0, y: 0, z: 0 };
      if (hasAbove) n.above = { x: 0, y: 1, z: 0 };
      return n;
    };
    const cell = { x: 0, y: 0, z: 0 };
    return {
      h0_noAbove: resolveTile(cell, mkN(0, false)),
      h0_above:   resolveTile(cell, mkN(0, true)),
      h1_above:   resolveTile(cell, mkN(1, true)),
      h2_above:   resolveTile(cell, mkN(2, true)),
      h4_noAbove: resolveTile(cell, mkN(4, false)),
    };
  });
  expect(result).toEqual({
    h0_noAbove: 'roof',
    h0_above:   'freestanding',
    h1_above:   'corner',
    h2_above:   'wall',
    h4_noAbove: 'roof',
  });
});
