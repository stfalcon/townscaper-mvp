import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test.describe('T-006: math-picking + hover', () => {
  test('pointer move over empty grid shows hover outline at ground coord', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(300);

    // Move pointer to screen center
    const { width, height } = page.viewportSize();
    await page.mouse.move(Math.floor(width / 2), Math.floor(height / 2));
    await page.waitForTimeout(150);

    const hover = await page.evaluate(() => {
      const r = window.__game__.renderer;
      return {
        visible: r.hoverMesh.visible,
        pos: { x: r.hoverMesh.position.x, y: r.hoverMesh.position.y, z: r.hoverMesh.position.z },
      };
    });
    expect(hover.visible).toBe(true);
    // Hovering over center of 30×30 grid → approximately (15, 0, 15) — tolerance ±2
    expect(hover.pos.y).toBeCloseTo(0.5, 1);
    expect(hover.pos.x).toBeGreaterThan(13.5);
    expect(hover.pos.x).toBeLessThan(16.5);
    expect(hover.pos.z).toBeGreaterThan(13.5);
    expect(hover.pos.z).toBeLessThan(16.5);
  });

  test('pointerleave hides hover', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    const { width, height } = page.viewportSize();
    await page.mouse.move(Math.floor(width / 2), Math.floor(height / 2));
    await page.waitForTimeout(100);

    // Dispatch synthetic pointerleave on canvas
    await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      canvas.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    });
    await page.waitForTimeout(100);

    const visible = await page.evaluate(() => window.__game__.renderer.hoverMesh.visible);
    expect(visible).toBe(false);
  });

  test('hovering over cube puts outline on an adjacent face', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      window.__game__.state.setCell(15, 0, 15, { colorId: 2 });
    });
    const { width, height } = page.viewportSize();
    await page.mouse.move(Math.floor(width / 2), Math.floor(height / 2));
    await page.waitForTimeout(150);

    const pos = await page.evaluate(() => {
      const r = window.__game__.renderer;
      return r.hoverMesh.visible
        ? { x: r.hoverMesh.position.x, y: r.hoverMesh.position.y, z: r.hoverMesh.position.z }
        : null;
    });
    expect(pos).not.toBeNull();
    // Hover should be at an adjacent cell center. Cube center is (15.5, 0.5, 15.5).
    // Adjacent cell center is (15.5±1, 0.5, 15.5) OR (15.5, 0.5, 15.5±1) OR (15.5, 1.5, 15.5).
    // Either way, L1-distance between hover and cube center is exactly 1 unit.
    const d = Math.abs(pos.x - 15.5) + Math.abs(pos.y - 0.5) + Math.abs(pos.z - 15.5);
    expect(d).toBeCloseTo(1, 1);
  });

  test('visual snapshot: scene with hover outline visible', async ({ page }) => {
    mkdirSync('docs/screenshots', { recursive: true });
    await page.goto('/?spawn=80');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(800);

    const { width, height } = page.viewportSize();
    await page.mouse.move(Math.floor(width / 2), Math.floor(height / 2));
    await page.waitForTimeout(300);

    await page.screenshot({
      path: 'docs/screenshots/T-006-hover.png',
      fullPage: false,
    });
  });
});
