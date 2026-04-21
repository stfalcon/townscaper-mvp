import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test.describe('T-PH2-W1: water + land two-layer mechanic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('scene has water plane at y=0 and land pool', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
      const r = window.__game__.renderer;
      return {
        hasWaterMesh: !!r.water,
        waterColor: r.water?.material?.color?.getHex(),
        poolsKeys: Object.keys(r.pools).sort(),
      };
    });
    expect(info.hasWaterMesh).toBe(true);
    expect(info.poolsKeys).toEqual(['corner', 'freestanding', 'land', 'roof', 'wall']);
  });

  test('click on water places land (not building)', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('#palette');
    await page.waitForTimeout(300);

    const v = page.viewportSize();
    await page.mouse.click(Math.floor(v.width / 2), Math.floor(v.height / 2));
    await page.waitForTimeout(200);

    const cells = await page.evaluate(() =>
      window.__game__.state.all().map((c) => ({ y: c.y, type: c.type })),
    );
    expect(cells).toHaveLength(1);
    expect(cells[0].y).toBe(0);
    expect(cells[0].type).toBe('land');
  });

  test('click on existing land places building on top', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('#palette');
    await page.waitForTimeout(300);

    // Seed land + compute screen coord for that cell's top face.
    await page.evaluate(() => {
      window.__game__.state.setCell(15, 0, 15, { type: 'land' });
    });
    await page.waitForTimeout(100);

    const screen = await page.evaluate(() => {
      const { renderer } = window.__game__;
      const cam = renderer.camera;
      const m = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse);
      const e = m.elements;
      const x = 15.5, y = 1.0, z = 15.5, w = 1;
      const px = e[0] * x + e[4] * y + e[8] * z + e[12] * w;
      const py = e[1] * x + e[5] * y + e[9] * z + e[13] * w;
      const pw = e[3] * x + e[7] * y + e[11] * z + e[15] * w;
      return {
        x: ((px / pw + 1) / 2) * window.innerWidth,
        y: ((-py / pw + 1) / 2) * window.innerHeight,
      };
    });

    await page.mouse.click(Math.round(screen.x), Math.round(screen.y));
    await page.waitForTimeout(200);

    const result = await page.evaluate(() =>
      window.__game__.state.all().map((c) => ({ x: c.x, y: c.y, z: c.z, type: c.type })),
    );
    expect(result).toHaveLength(2);
    const land = result.find((c) => c.type === 'land');
    const building = result.find((c) => c.type === 'building');
    expect(land).toMatchObject({ x: 15, y: 0, z: 15 });
    expect(building).toBeDefined();
    expect(building.y).toBeGreaterThanOrEqual(1);
  });

  test('buildings cannot be placed directly on water (no land)', async ({ page }) => {
    await page.goto('/?fresh=1');
    const ok = await page.evaluate(() =>
      window.__game__.state.canPlace(5, 0, 5, 'building'),
    );
    expect(ok.ok).toBe(false);
    expect(ok.reason).toBe('building-needs-land');
  });

  test('save/load round-trip preserves land+building types', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    await page.evaluate(() => {
      const s = window.__game__.state;
      s.setCell(5, 0, 5, { type: 'land' });
      s.setCell(5, 1, 5, { colorId: 2, type: 'building' });
      s.setCell(5, 2, 5, { colorId: 3, type: 'building' });
      window.__game__.saveState.flush();
    });

    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(300);

    const restored = await page.evaluate(() =>
      window.__game__.state.all()
        .map((c) => ({ x: c.x, y: c.y, z: c.z, type: c.type, colorId: c.colorId }))
        .sort((a, b) => a.y - b.y),
    );
    expect(restored).toHaveLength(3);
    expect(restored[0]).toMatchObject({ y: 0, type: 'land' });
    expect(restored[1]).toMatchObject({ y: 1, type: 'building', colorId: 2 });
    expect(restored[2]).toMatchObject({ y: 2, type: 'building', colorId: 3 });
  });

  test('visual snapshot: island with houses', async ({ page }) => {
    mkdirSync('docs/screenshots', { recursive: true });
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(300);

    // Build a small island (3×3 land) with 4 colored buildings on top.
    await page.evaluate(() => {
      const s = window.__game__.state;
      const cx = 15, cz = 15;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          s.setCell(cx + dx, 0, cz + dz, { type: 'land' });
        }
      }
      // Two-storey little town
      s.setCell(cx, 1, cz, { colorId: 2, type: 'building' });
      s.setCell(cx, 2, cz, { colorId: 5, type: 'building' });
      s.setCell(cx + 1, 1, cz, { colorId: 4, type: 'building' });
      s.setCell(cx, 1, cz + 1, { colorId: 3, type: 'building' });
    });
    await page.waitForTimeout(500);
    await page.mouse.move(5, 5); // clear any hover outline
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'docs/screenshots/T-PH2-W1-island.png', fullPage: false });
  });
});
