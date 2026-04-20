import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

async function getYaw(page) {
  return page.evaluate(() => window.__game__.renderer.yaw);
}
async function getZoom(page) {
  return page.evaluate(() => window.__game__.renderer.zoomLevel);
}

test.describe('T-CAM: camera rotate + zoom', () => {
  test('AC-F9-01: E rotates yaw by +π/2', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    const before = await getYaw(page);
    await page.evaluate(() => document.getElementById('canvas').focus());
    await page.keyboard.press('e');
    await page.waitForTimeout(300); // let 200ms tween finish
    const after = await getYaw(page);
    expect(after - before).toBeCloseTo(Math.PI / 2, 3);
  });

  test('AC-F9-01b: Q rotates yaw by -π/2', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    const before = await getYaw(page);
    await page.keyboard.press('q');
    await page.waitForTimeout(300);
    const after = await getYaw(page);
    expect(after - before).toBeCloseTo(-Math.PI / 2, 3);
  });

  test('AC-F9-02: wheel down increments zoom', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    const before = await getZoom(page);
    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, -100); // scroll up (zoom in)
    await page.waitForTimeout(200);
    const after = await getZoom(page);
    expect(after).toBeGreaterThan(before);
    expect(after).toBeCloseTo(before + 0.1, 5);
  });

  test('AC-F9-03: scrolling past max clamps at 2.0', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    await page.mouse.move(400, 400);
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, -100);
    }
    await page.waitForTimeout(300);
    const zoom = await getZoom(page);
    expect(zoom).toBeCloseTo(2.0, 5);
  });

  test('AC-F9-04: scrolling past min clamps at 0.5', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    await page.mouse.move(400, 400);
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, 100);
    }
    await page.waitForTimeout(300);
    const zoom = await getZoom(page);
    expect(zoom).toBeCloseTo(0.5, 5);
  });

  test('wheel does not scroll the page', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(100);
    const scrollAfter = await page.evaluate(() => window.scrollY);
    expect(scrollAfter).toBe(scrollBefore);
  });

  test('picking still works after 90° rotation (regression guard)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    await page.keyboard.press('e');
    await page.waitForTimeout(300);

    const v = page.viewportSize();
    await page.mouse.click(Math.floor(v.width / 2), Math.floor(v.height / 2));
    await page.waitForTimeout(150);
    const total = await page.evaluate(() => window.__game__.state.all().length);
    expect(total).toBe(1);
  });

  test('visual snapshot: scene after rotate + zoom', async ({ page }) => {
    mkdirSync('docs/screenshots', { recursive: true });
    await page.goto('/?spawn=120');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(800);

    await page.mouse.move(400, 400);
    // Zoom in twice
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(60);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(60);
    // Rotate once
    await page.keyboard.press('e');
    await page.waitForTimeout(300);

    // Move mouse away so no hover overlay
    await page.mouse.move(5, 5);
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'docs/screenshots/T-CAM-rotated.png' });
  });
});
