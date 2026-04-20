import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

async function center(page) {
  const v = page.viewportSize();
  return { x: Math.floor(v.width / 2), y: Math.floor(v.height / 2) };
}

test.describe('T-007: click place / remove', () => {
  test('LMB click on empty ground places a cell', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    const { x, y } = await center(page);
    await page.mouse.click(x, y);
    await page.waitForTimeout(150);

    const total = await page.evaluate(() => window.__game__.state.all().length);
    expect(total).toBe(1);
  });

  test('RMB click removes a hit cell', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    // Place a cube programmatically, then RMB-click near its screen center
    await page.evaluate(() => window.__game__.state.setCell(15, 0, 15, { colorId: 2 }));
    const { x, y } = await center(page);
    await page.mouse.click(x, y, { button: 'right' });
    await page.waitForTimeout(150);

    const total = await page.evaluate(() => window.__game__.state.all().length);
    expect(total).toBe(0);
  });

  test('drag beyond 8px threshold is ignored (AC-F1-09)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    const { x, y } = await center(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 30, y + 30, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    const total = await page.evaluate(() => window.__game__.state.all().length);
    expect(total).toBe(0);
  });

  test('contextmenu on canvas is suppressed (AC-F2-01)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    const { x, y } = await center(page);
    const defaultPrevented = await page.evaluate(({ x, y }) => {
      const canvas = document.getElementById('canvas');
      const evt = new MouseEvent('contextmenu', {
        bubbles: true, cancelable: true, clientX: x, clientY: y,
      });
      const dispatched = canvas.dispatchEvent(evt);
      return { defaultPrevented: !dispatched };
    }, { x, y });
    expect(defaultPrevented.defaultPrevented).toBe(true);
  });

  test('erase mode: LMB removes a hit cell (AC-F2-02)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      window.__game__.state.setCell(15, 0, 15, { colorId: 2 });
      window.__game__.input.mode = 'erase';
    });
    const { x, y } = await center(page);
    await page.mouse.click(x, y);
    await page.waitForTimeout(150);

    const total = await page.evaluate(() => window.__game__.state.all().length);
    expect(total).toBe(0);
  });

  test('stack by clicking on top of an existing cube', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    const { x, y } = await center(page);
    await page.mouse.click(x, y);
    await page.waitForTimeout(100);
    await page.mouse.click(x, y);
    await page.waitForTimeout(100);

    const stats = await page.evaluate(() => ({
      total: window.__game__.state.all().length,
      pools: window.__game__.renderer.getPoolStats(),
    }));
    // Two clicks at same screen point — first places on ground, second places
    // adjacent (the ray now hits the placed cube at ground level from a side).
    expect(stats.total).toBe(2);
  });

  test('visual snapshot: click-placed cluster', async ({ page }) => {
    mkdirSync('docs/screenshots', { recursive: true });
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(300);

    // Cycle colors via DevTools-style handle and click several positions
    const { x, y } = await center(page);
    const offsets = [
      [0, 0, 2], [-40, -20, 3], [40, -20, 4], [-60, 20, 5], [60, 20, 1],
      [0, 40, 2], [-80, 0, 3], [80, 0, 4],
    ];
    for (const [dx, dy, colorId] of offsets) {
      await page.evaluate((id) => { window.__game__.input.currentColorId = id; }, colorId);
      await page.mouse.click(x + dx, y + dy);
      await page.waitForTimeout(40);
    }
    // Move pointer away so no hover overlay in screenshot
    await page.mouse.move(5, 5);
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'docs/screenshots/T-007-clicked.png' });
  });
});
