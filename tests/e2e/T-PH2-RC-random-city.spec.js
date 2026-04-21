import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test.describe('T-PH2-RC: Random City (R key)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('R key triggers a seeded island with buildings', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(300);

    await page.keyboard.press('r');
    // Generation has a staggered schedule (~40ms/cell × ~60 cells). Wait
    // generously past the expected end.
    await page.waitForTimeout(4000);

    const summary = await page.evaluate(() => {
      const cells = window.__game__.state.all();
      return {
        total: cells.length,
        land: cells.filter((c) => c.type === 'land').length,
        buildings: cells.filter((c) => c.type === 'building').length,
      };
    });
    expect(summary.land).toBeGreaterThanOrEqual(20);
    expect(summary.buildings).toBeGreaterThanOrEqual(15);
    expect(summary.total).toBe(summary.land + summary.buildings);
  });

  test('R replaces any existing scene (clear first)', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    // Seed a manual scene.
    await page.evaluate(() => {
      const s = window.__game__.state;
      s.setCell(5, 0, 5, { type: 'land' });
      s.setCell(5, 1, 5, { colorId: 2, type: 'building' });
    });
    await page.waitForTimeout(200);

    await page.keyboard.press('r');
    await page.waitForTimeout(4000);

    // Original cells gone, new city present.
    const result = await page.evaluate(() => {
      const cells = window.__game__.state.all();
      return {
        hasManualCell: cells.some((c) => c.x === 5 && c.y === 1 && c.z === 5 && c.colorId === 2),
        total: cells.length,
      };
    });
    expect(result.hasManualCell).toBe(false);
    expect(result.total).toBeGreaterThan(30);
  });

  test('visual snapshot: generated city with island', async ({ page }) => {
    mkdirSync('docs/screenshots', { recursive: true });
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(300);

    await page.keyboard.press('r');
    await page.waitForTimeout(5000);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(200);

    await page.screenshot({ path: 'docs/screenshots/T-PH2-RC-random-city.png', fullPage: false });
  });
});
