import { test, expect } from '@playwright/test';

test.describe('fix/erase-hover: outline highlights the CUBE not the placement target', () => {
  test('in erase mode, hovering a cube outlines that cube', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    // Place a cube at grid center, switch to erase, hover center
    await page.evaluate(() => {
      window.__game__.state.setCell(15, 0, 15, { colorId: 2 });
      window.__game__.ui.setMode('erase');
    });
    const v = page.viewportSize();
    await page.mouse.move(Math.floor(v.width / 2), Math.floor(v.height / 2));
    await page.waitForTimeout(150);

    const hover = await page.evaluate(() => {
      const r = window.__game__.renderer;
      return {
        visible: r.hoverMesh.visible,
        pos: { x: r.hoverMesh.position.x, y: r.hoverMesh.position.y, z: r.hoverMesh.position.z },
        colorHex: r.hoverMesh.material.color.getHex(),
      };
    });
    expect(hover.visible).toBe(true);
    // Cube is at (15, 0, 15) — world center (15.5, 0.5, 15.5)
    expect(hover.pos.x).toBeCloseTo(15.5, 1);
    expect(hover.pos.y).toBeCloseTo(0.5, 1);
    expect(hover.pos.z).toBeCloseTo(15.5, 1);
    expect(hover.colorHex).toBe(0xff4444);
  });

  test('in erase mode, hovering empty ground HIDES the outline', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    await page.evaluate(() => {
      window.__game__.state.setCell(5, 0, 5, { colorId: 2 });
      window.__game__.ui.setMode('erase');
    });
    const v = page.viewportSize();
    await page.mouse.move(Math.floor(v.width / 2), Math.floor(v.height / 2));
    await page.waitForTimeout(100);

    const visible = await page.evaluate(() => window.__game__.renderer.hoverMesh.visible);
    expect(visible).toBe(false);
  });

  test('switching Build → Erase re-evaluates hover without pointer movement', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    await page.evaluate(() => {
      window.__game__.state.setCell(15, 0, 15, { colorId: 2 });
    });
    const v = page.viewportSize();
    const cx = Math.floor(v.width / 2);
    const cy = Math.floor(v.height / 2);
    await page.mouse.move(cx, cy);
    await page.waitForTimeout(100);

    // In Build mode — outline is at ADJACENT cell, not the cube at (15,0,15)
    const before = await page.evaluate(() => {
      const r = window.__game__.renderer;
      return { x: r.hoverMesh.position.x, y: r.hoverMesh.position.y, z: r.hoverMesh.position.z };
    });
    // Adjacent cell center is 1 L1-unit from cube center (15.5, 0.5, 15.5)
    const l1Before = Math.abs(before.x - 15.5) + Math.abs(before.y - 0.5) + Math.abs(before.z - 15.5);
    expect(l1Before).toBeCloseTo(1, 1);

    // Switch to erase via UI button (same as clicking it)
    await page.evaluate(() => window.__game__.ui.setMode('erase'));
    await page.waitForTimeout(50);

    const after = await page.evaluate(() => {
      const r = window.__game__.renderer;
      return {
        x: r.hoverMesh.position.x, y: r.hoverMesh.position.y, z: r.hoverMesh.position.z,
        color: r.hoverMesh.material.color.getHex(),
      };
    });
    // Now outline sits ON the cube
    expect(after.x).toBeCloseTo(15.5, 1);
    expect(after.y).toBeCloseTo(0.5, 1);
    expect(after.z).toBeCloseTo(15.5, 1);
    expect(after.color).toBe(0xff4444);
  });
});
