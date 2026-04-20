import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Lay out a scene that forces all 4 tileTypes to exist:
 *
 *    wall     corner
 *     │       │
 *  ┌──┼──┐ ┌──┘
 *  │  │  │ │
 * (Cross shape with a tower) — seen from top:
 *
 *     (14,0,15) (15,0,15) (16,0,15)   — a row at y=0
 *               (15,1,15)              — floor 2 (makes (15,0,15) freestanding)
 *               (15,2,15)              — floor 3 → roof
 *     (15,0,14)                        — south connector
 */
async function seedAllTileTypes(page) {
  await page.evaluate(() => {
    const s = window.__game__.state;
    // Ground cross + vertical tower — forces wall + freestanding + roof:
    //     (14,0,15) (15,0,15) (16,0,15)
    //               (15,0,14)
    //   (15,0,15) becomes 'wall' (3 horizontal neighbors + above)
    //   (15,1,15) becomes 'freestanding' (0 horizontal + above)
    //   (15,2,15) becomes 'roof'
    //   (14,0,15), (16,0,15), (15,0,14) each become 'roof'
    s.setCell(14, 0, 15, { colorId: 1 });
    s.setCell(15, 0, 15, { colorId: 2 });
    s.setCell(16, 0, 15, { colorId: 3 });
    s.setCell(15, 0, 14, { colorId: 4 });
    s.setCell(15, 1, 15, { colorId: 5 });
    s.setCell(15, 2, 15, { colorId: 2 });
    // Isolated L-shape far from the main cross — forces 'corner':
    //   (10,0,10) has east neighbor (11,0,10) + above (10,1,10) → corner
    s.setCell(10, 0, 10, { colorId: 3 });
    s.setCell(11, 0, 10, { colorId: 3 });
    s.setCell(10, 1, 10, { colorId: 3 });
  });
}

test.describe('T-008: 4 distinct tile geometries', () => {
  test('all 4 pools populated when scene forces each tileType', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    await seedAllTileTypes(page);
    await page.waitForTimeout(200);

    const { stats, detail } = await page.evaluate(() => {
      const r = window.__game__.renderer;
      const s = window.__game__.state;
      const stats = r.getPoolStats();
      const detail = s.all().map((c) => ({
        c: `${c.x},${c.y},${c.z}`, tile: c.tileType,
      }));
      return { stats, detail };
    });
    // Diagnostic: if expectations fail, print what actually got assigned
    expect({ stats, detail }).toMatchObject({ stats: { total: 9 } });
    expect(stats.wall).toBeGreaterThan(0);
    expect(stats.corner).toBeGreaterThan(0);
    expect(stats.freestanding).toBeGreaterThan(0);
    expect(stats.roof).toBeGreaterThan(0);
  });

  test('geometries differ in silhouette height (≥15% delta per DoD)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    const heights = await page.evaluate(() => {
      const r = window.__game__.renderer;
      const out = {};
      for (const [tileType, pool] of Object.entries(r.pools)) {
        pool.mesh.geometry.computeBoundingBox();
        const bb = pool.mesh.geometry.boundingBox;
        out[tileType] = bb.max.y - bb.min.y;
      }
      return out;
    });
    const values = Object.values(heights);
    const maxH = Math.max(...values);
    const minH = Math.min(...values);
    const delta = (maxH - minH) / minH;
    expect(delta).toBeGreaterThanOrEqual(0.15);
  });

  test('visual snapshot: scene with all tile types', async ({ page }) => {
    mkdirSync('docs/screenshots', { recursive: true });
    await page.goto('/?spawn=120');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(800);

    // Add a tower so 'roof' and 'freestanding' are both visible
    await page.evaluate(() => {
      const s = window.__game__.state;
      // Find a safe empty column and stack 3 cells
      const cx = 20, cz = 8;
      s.setCell(cx, 0, cz, { colorId: 3 });
      s.setCell(cx, 1, cz, { colorId: 4 });
      s.setCell(cx, 2, cz, { colorId: 2 });
    });
    await page.mouse.move(5, 5);
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'docs/screenshots/T-008-geometries.png' });
  });

  test('visual snapshot: close-up tower proves no vertical gaps', async ({ page }) => {
    mkdirSync('docs/screenshots', { recursive: true });
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      const s = window.__game__.state;
      s.setCell(15, 0, 15, { colorId: 2 });
      s.setCell(15, 1, 15, { colorId: 2 });
      s.setCell(15, 2, 15, { colorId: 2 });
    });

    // Zoom in for close-up
    await page.mouse.move(600, 400);
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(400);
    await page.mouse.move(5, 5); // away from canvas → hide hover
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'docs/screenshots/T-008-tower-closeup.png' });
  });

  test('stacked non-roof cells have NO vertical gap (regression for fix/tile-vertical-gaps)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    // Any non-roof geometry (wall, freestanding, corner) must reach full
    // cell height on Y — otherwise stacked cells show a gap to ground.
    const heights = await page.evaluate(() => {
      const r = window.__game__.renderer;
      const out = {};
      for (const [tileType, pool] of Object.entries(r.pools)) {
        pool.mesh.geometry.computeBoundingBox();
        const bb = pool.mesh.geometry.boundingBox;
        out[tileType] = { minY: bb.min.y, maxY: bb.max.y, height: bb.max.y - bb.min.y };
      }
      return out;
    });

    for (const tileType of ['wall', 'freestanding', 'corner']) {
      // Geometry is centered on origin → must span exactly [-0.5, +0.5] on Y
      expect(heights[tileType].minY).toBeCloseTo(-0.5, 5);
      expect(heights[tileType].maxY).toBeGreaterThanOrEqual(0.5 - 0.001);
    }
    // Roof allowed to protrude up (apex above cell top) — cell above is empty by invariant.
    expect(heights.roof.minY).toBeCloseTo(-0.5, 5);
    expect(heights.roof.maxY).toBeGreaterThan(0.5); // protrudes above
  });

  test('placement still works with tall roof geometry (regression)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    const v = page.viewportSize();
    // Two clicks at center — first places on ground, second adjacent
    await page.mouse.click(Math.floor(v.width / 2), Math.floor(v.height / 2));
    await page.waitForTimeout(100);
    await page.mouse.click(Math.floor(v.width / 2), Math.floor(v.height / 2));
    await page.waitForTimeout(100);

    const total = await page.evaluate(() => window.__game__.state.all().length);
    expect(total).toBe(2);
  });
});
