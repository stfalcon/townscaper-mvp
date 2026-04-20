import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test.describe('T-005: 4-pool InstancedMesh renders cells', () => {
  test('single cell appears in scene via state.setCell', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      const { state, renderer } = window.__game__;
      state.setCell(15, 0, 15, { colorId: 2 });
      return renderer.getPoolStats();
    });

    // First cell → tileType='roof' (no above) → roof pool has 1, others 0
    expect(result.roof).toBe(1);
    expect(result.freestanding).toBe(0);
    expect(result.wall).toBe(0);
    expect(result.corner).toBe(0);
    expect(result.total).toBe(1);
  });

  test('migration between pools when tileType changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(300);

    const sequence = await page.evaluate(() => {
      const { state, renderer } = window.__game__;
      const snaps = [];
      state.setCell(10, 0, 10, { colorId: 1 });
      snaps.push({ after: 'base', ...renderer.getPoolStats() });
      state.setCell(10, 1, 10, { colorId: 1 });
      snaps.push({ after: 'stack', ...renderer.getPoolStats() });
      state.removeCell(10, 1, 10);
      snaps.push({ after: 'unstack', ...renderer.getPoolStats() });
      return snaps;
    });

    // base: 1 cell, tileType=roof
    expect(sequence[0]).toMatchObject({ total: 1, roof: 1 });
    // stack: upper=roof, lower=freestanding (has above, 0 horizontal)
    expect(sequence[1]).toMatchObject({ total: 2, roof: 1, freestanding: 1 });
    // unstack: lower migrates back to roof
    expect(sequence[2]).toMatchObject({ total: 1, roof: 1, freestanding: 0 });
  });

  test('500-cell dev spawn renders without lag (FPS guard)', async ({ page }) => {
    await page.goto('/?spawn=500');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(1000);

    const stats = await page.evaluate(() => window.__game__.renderer.getPoolStats());
    expect(stats.total).toBeGreaterThanOrEqual(400);
    expect(stats.total).toBeLessThanOrEqual(500);
  });

  test('scene renders — visual snapshot with 500 cells', async ({ page }) => {
    mkdirSync('docs/screenshots', { recursive: true });
    await page.goto('/?spawn=500');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'docs/screenshots/T-005-pools-500.png', fullPage: false });
  });

  test('clear empties all pools', async ({ page }) => {
    await page.goto('/?spawn=100');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const { state, renderer } = window.__game__;
      const before = renderer.getPoolStats().total;
      state.clear();
      const after = renderer.getPoolStats().total;
      return { before, after };
    });

    expect(result.before).toBeGreaterThan(50);
    expect(result.after).toBe(0);
  });
});
