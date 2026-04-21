import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test.describe('T-011: palette UI + keyboard + surprise unlock', () => {
  test('palette renders 6 buttons with 6th initially hidden', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#palette .color-btn');
    const info = await page.evaluate(() => {
      const btns = document.querySelectorAll('#palette .color-btn');
      return {
        count: btns.length,
        locked: Array.from(btns).map((b) => b.dataset.locked === 'true'),
        selected: Array.from(btns).map((b) => b.dataset.selected === 'true'),
      };
    });
    expect(info.count).toBe(6);
    expect(info.locked).toEqual([false, false, false, false, false, true]);
    // Default selection = colorId 1
    expect(info.selected).toEqual([true, false, false, false, false, false]);
  });

  test('AC-F4-02: click on palette button changes selectedColorId', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#palette');
    await page.locator('.color-btn[data-color-id="3"]').click();
    await page.waitForTimeout(50);

    const selected = await page.evaluate(() => window.__game__.input.currentColorId);
    expect(selected).toBe(3);

    const btnSelected = await page.evaluate(() =>
      document.querySelector('.color-btn[data-color-id="3"]').dataset.selected,
    );
    expect(btnSelected).toBe('true');
  });

  test('AC-F4-01: keys 1-5 select color', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#palette');
    for (const id of [2, 3, 4, 5, 1]) {
      await page.keyboard.press(String(id));
      await page.waitForTimeout(40);
      const current = await page.evaluate(() => window.__game__.input.currentColorId);
      expect(current).toBe(id);
    }
  });

  test('AC-F4-03: keys 0, 7, 8, 9 are ignored', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#palette');
    await page.keyboard.press('3');
    await page.waitForTimeout(50);
    for (const key of ['0', '7', '8', '9']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(30);
      const current = await page.evaluate(() => window.__game__.input.currentColorId);
      expect(current).toBe(3);
    }
  });

  test('key "6" does nothing while surprise is locked', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#palette');
    await page.keyboard.press('2');
    await page.waitForTimeout(30);
    await page.keyboard.press('6');
    await page.waitForTimeout(50);
    const current = await page.evaluate(() => window.__game__.input.currentColorId);
    expect(current).toBe(2);
  });

  test('AC-F12-01: Surprise color unlocks after 10 placements', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#palette');

    const before = await page.evaluate(() => ({
      locked: document.querySelector('.color-btn[data-color-id="6"]').dataset.locked,
      surprise: window.__game__.ui.surpriseUnlocked,
    }));
    expect(before.locked).toBe('true');
    expect(before.surprise).toBe(false);

    // Place 10 cells directly through state
    await page.evaluate(() => {
      const s = window.__game__.state;
      for (let i = 0; i < 10; i++) {
        s.setCell(i, 0, 0, { colorId: 1 });
      }
    });
    await page.waitForTimeout(100);

    const after = await page.evaluate(() => ({
      locked: document.querySelector('.color-btn[data-color-id="6"]').dataset.locked,
      surprise: window.__game__.ui.surpriseUnlocked,
      placementsCount: window.__game__.ui.placementsCount,
    }));
    expect(after.locked).toBeUndefined();
    expect(after.surprise).toBe(true);
    expect(after.placementsCount).toBe(10);

    // Now key 6 works
    await page.keyboard.press('6');
    await page.waitForTimeout(50);
    const current = await page.evaluate(() => window.__game__.input.currentColorId);
    expect(current).toBe(6);
  });

  test('clicking a color button does not place a cell on canvas', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#palette');
    await page.locator('.color-btn[data-color-id="4"]').click();
    await page.waitForTimeout(50);
    const total = await page.evaluate(() => window.__game__.state.all().length);
    expect(total).toBe(0);
  });

  test('placement on land uses the selected color', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#palette');
    await page.locator('.color-btn[data-color-id="3"]').click();
    await page.waitForTimeout(50);

    // Seed a land pad directly via state so we don't depend on mouse→world
    // ray geometry. Then a real user click on that land cube's screen-space
    // location should place a BUILDING at y=1 with the palette color.
    await page.evaluate(() => {
      window.__game__.state.setCell(15, 0, 15, { type: 'land' });
    });
    await page.waitForTimeout(100);

    // Project world cell center to screen for a deterministic click point.
    const screen = await page.evaluate(() => {
      const { renderer } = window.__game__;
      const THREE = { Vector3: class {
        constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
        project(cam) {
          const v = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse);
          const arr = [this.x, this.y, this.z, 1];
          const out = [0, 0, 0, 0];
          const e = v.elements;
          for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++)
              out[r] += e[r + c * 4] * arr[c];
          out[0] /= out[3]; out[1] /= out[3]; out[2] /= out[3];
          return { x: out[0], y: out[1], z: out[2] };
        }
      }};
      const p = new THREE.Vector3(15.5, 1.0, 15.5).project(renderer.camera);
      return {
        x: ((p.x + 1) / 2) * window.innerWidth,
        y: ((-p.y + 1) / 2) * window.innerHeight,
      };
    });
    await page.mouse.click(Math.round(screen.x), Math.round(screen.y));
    await page.waitForTimeout(200);

    const cells = await page.evaluate(() =>
      window.__game__.state.all().map((c) => ({ x: c.x, y: c.y, z: c.z, type: c.type, colorId: c.colorId })),
    );
    const building = cells.find((c) => c.type === 'building');
    expect(building).toBeDefined();
    expect(building.colorId).toBe(3);
  });

  test('visual snapshot: palette visible + colored tower', async ({ page }) => {
    mkdirSync('docs/screenshots', { recursive: true });
    await page.goto('/');
    await page.waitForSelector('#palette');

    // Build a colorful tower via palette + clicks
    const v = page.viewportSize();
    const cx = Math.floor(v.width / 2);
    const cy = Math.floor(v.height / 2);
    for (const id of [2, 5, 3, 4]) {
      await page.locator(`.color-btn[data-color-id="${id}"]`).click();
      await page.waitForTimeout(30);
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(60);
    }
    await page.mouse.move(5, 5);
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'docs/screenshots/T-011-palette.png' });
  });
});
