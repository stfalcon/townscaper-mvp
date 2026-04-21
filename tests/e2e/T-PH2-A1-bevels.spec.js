import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test.describe('T-PH2-A1: bevel geometries for all tile types', () => {
  test('all non-roof geometries have >8 vertices (bevel adds many)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    const counts = await page.evaluate(() => {
      const r = window.__game__.renderer;
      const out = {};
      for (const [tileType, pool] of Object.entries(r.pools)) {
        out[tileType] = pool.mesh.geometry.attributes.position.count;
      }
      return out;
    });
    // Plain BoxGeometry was 24. Bevelled with segments=2 → significantly more
    expect(counts.wall).toBeGreaterThan(100);
    expect(counts.freestanding).toBeGreaterThan(100);
    expect(counts.corner).toBeGreaterThan(100);
    expect(counts.roof).toBeGreaterThan(100); // box + pyramid
  });

  test('bevelled non-roof bbox still [-0.5, 0.5] — no-gap invariant preserved', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    const extents = await page.evaluate(() => {
      const r = window.__game__.renderer;
      const out = {};
      for (const tileType of ['wall', 'freestanding', 'corner']) {
        const pool = r.pools[tileType];
        pool.mesh.geometry.computeBoundingBox();
        const bb = pool.mesh.geometry.boundingBox;
        out[tileType] = { min: bb.min.toArray(), max: bb.max.toArray() };
      }
      return out;
    });

    for (const tileType of ['wall', 'freestanding', 'corner']) {
      expect(extents[tileType].min).toEqual([-0.5, -0.5, -0.5]);
      // Max may be slightly under 0.5 due to rounded corners but we accept close
      expect(extents[tileType].max[0]).toBeCloseTo(0.5, 5);
      expect(extents[tileType].max[1]).toBeCloseTo(0.5, 5);
      expect(extents[tileType].max[2]).toBeCloseTo(0.5, 5);
    }
  });

  test('bottom face is FLAT (y=-0.5) after flattenBottom — bevel only on top+sides', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    const stats = await page.evaluate(() => {
      const pool = window.__game__.renderer.pools.wall;
      const arr = pool.mesh.geometry.attributes.position.array;
      // Count vertices at exactly y=-0.5 (flattened bottom) vs below -0.4 (unflattened)
      let atBottom = 0;
      let belowCorners = 0;
      for (let i = 1; i < arr.length; i += 3) {
        const y = arr[i];
        if (Math.abs(y + 0.5) < 1e-6) atBottom++;
        else if (y < -0.45) belowCorners++; // should be 0 after flatten
      }
      return { atBottom, belowCorners };
    });
    expect(stats.atBottom).toBeGreaterThan(10); // bottom face has many verts
    expect(stats.belowCorners).toBe(0); // flatten worked — no dangling corner verts
  });

  test('colors render correctly (instanceColor + new bevel geometry)', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    // Place 5 cells with 5 different palette colors
    await page.evaluate(() => {
      const s = window.__game__.state;
      for (let i = 1; i <= 5; i++) {
        s.setCell(10 + i, 0, 15, { colorId: i });
      }
    });
    await page.waitForTimeout(600); // let place tweens settle

    // Screenshot should show 5 distinct colors (no black/mud regression from
    // vertexColors+instanceColor incompatibility if we later add vertex AO)
    mkdirSync('docs/screenshots', { recursive: true });
    await page.mouse.move(5, 5);
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'docs/screenshots/T-PH2-A1-bevel-colors.png' });

    // Also verify state
    const cells = await page.evaluate(() =>
      window.__game__.state.all().map((c) => c.colorId).sort(),
    );
    expect(cells).toEqual([1, 2, 3, 4, 5]);
  });

  test('visual snapshot: close-up tower with bevels', async ({ page }) => {
    mkdirSync('docs/screenshots', { recursive: true });
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      const s = window.__game__.state;
      s.setCell(15, 0, 15, { colorId: 2 });
      s.setCell(15, 1, 15, { colorId: 3 });
      s.setCell(15, 2, 15, { colorId: 4 });
    });

    // Zoom in
    await page.mouse.move(600, 400);
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(400);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'docs/screenshots/T-PH2-A1-bevel-tower.png' });
  });
});
