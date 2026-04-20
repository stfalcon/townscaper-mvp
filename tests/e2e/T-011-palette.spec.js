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

  test('placement uses the selected color', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#palette');
    await page.locator('.color-btn[data-color-id="3"]').click();
    await page.waitForTimeout(50);

    const v = page.viewportSize();
    await page.mouse.click(Math.floor(v.width / 2), Math.floor(v.height / 2));
    await page.waitForTimeout(100);

    const cells = await page.evaluate(() =>
      window.__game__.state.all().map((c) => c.colorId),
    );
    expect(cells).toHaveLength(1);
    expect(cells[0]).toBe(3);
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
