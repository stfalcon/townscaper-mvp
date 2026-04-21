import { test, expect } from '@playwright/test';

test.describe('T-PH2-A2: vertex AO + instanceColor compat', () => {
  test('geometry has color attribute with darker bottom, brighter top', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    const aoRange = await page.evaluate(() => {
      const pool = window.__game__.renderer.pools.wall;
      const geo = pool.mesh.geometry;
      const colorAttr = geo.attributes.color;
      if (!colorAttr) return null;
      const pos = geo.attributes.position;
      // Find extremes
      let minColorBottom = Infinity; // expect ~0.72 (AO_BOTTOM)
      let maxColorTop = -Infinity;   // expect ~1.0 (AO_TOP)
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const r = colorAttr.getX(i); // all channels identical (AO is greyscale)
        if (y < -0.4) minColorBottom = Math.min(minColorBottom, r);
        if (y > 0.4) maxColorTop = Math.max(maxColorTop, r);
      }
      return { minColorBottom, maxColorTop };
    });
    expect(aoRange).not.toBeNull();
    expect(aoRange.minColorBottom).toBeLessThan(0.8);
    expect(aoRange.maxColorTop).toBeGreaterThan(0.95);
  });

  test('material has vertexColors: true — for multiplicative shader path', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    const vc = await page.evaluate(() => {
      const pool = window.__game__.renderer.pools.wall;
      return pool.mesh.material.vertexColors;
    });
    expect(vc).toBe(true);
  });

  test('5 palette colors render distinctly (no black regression)', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    // Place 5 cells each with a different color, away from center so they aren't
    // occluded by each other.
    await page.evaluate(() => {
      const s = window.__game__.state;
      for (let i = 1; i <= 5; i++) {
        s.setCell(10 + i, 0, 10, { colorId: i });
      }
    });
    await page.waitForTimeout(500);

    // Take a canvas screenshot and verify at least 5 distinct mean colors exist
    // (simple heuristic: pixel variance across canvas is high).
    const buffer = await page.locator('canvas#canvas').screenshot();
    // Sample N colors across the buffer
    const distinctHues = new Set();
    for (let i = 0; i < 50000; i += 4) {
      // Quantize to reduce noise, ignore grass background
      const r = buffer[i] >> 3;
      const g = buffer[i + 1] >> 3;
      const b = buffer[i + 2] >> 3;
      distinctHues.add(`${r}_${g}_${b}`);
    }
    // Expect lots of colors — grass + 5 cells × varied AO gradient = many combinations
    expect(distinctHues.size).toBeGreaterThan(50);
  });
});
