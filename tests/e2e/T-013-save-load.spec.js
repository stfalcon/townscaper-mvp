import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test.describe('T-013: save/load via localStorage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('AC-F5-01 + AC-F5-02: round-trip — place cells, reload, cells restored', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    // Place 3 cells via state (bypasses UI quirks)
    await page.evaluate(() => {
      const s = window.__game__.state;
      s.setCell(5, 0, 5, { colorId: 2 });
      s.setCell(6, 0, 5, { colorId: 3 });
      s.setCell(5, 1, 5, { colorId: 4 });
    });
    // Force flush rather than wait 2s
    await page.evaluate(() => window.__game__.saveState.flush());

    // Reload fresh page (no ?fresh so it WILL load)
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(300);

    const restored = await page.evaluate(() => {
      const cells = window.__game__.state.all().map((c) => ({
        x: c.x, y: c.y, z: c.z, colorId: c.colorId, tileType: c.tileType,
      }));
      return cells.sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z);
    });
    expect(restored).toHaveLength(3);
    expect(restored[0]).toMatchObject({ x: 5, y: 0, z: 5, colorId: 2 });
    expect(restored[0].tileType).not.toBeNull(); // re-resolved on load
    expect(restored[2]).toMatchObject({ x: 6, y: 0, z: 5, colorId: 3 });
  });

  test('AC-F5-02: UI snapshot restored (selectedColorId, placementsCount)', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('#palette');

    // Place 11 cells via state (triggers surprise unlock at 10)
    await page.evaluate(() => {
      const s = window.__game__.state;
      for (let i = 0; i < 11; i++) s.setCell(i, 0, 0, { colorId: 1 });
    });
    // Pick color 4
    await page.keyboard.press('4');
    await page.waitForTimeout(50);
    await page.evaluate(() => window.__game__.saveState.flush());

    await page.goto('/');
    await page.waitForSelector('#palette');
    await page.waitForTimeout(200);

    const info = await page.evaluate(() => ({
      selectedColorId: window.__game__.input.currentColorId,
      placementsCount: window.__game__.ui.placementsCount,
      surpriseUnlocked: window.__game__.ui.surpriseUnlocked,
      sixthVisible: !document.querySelector('.color-btn[data-color-id="6"]').dataset.locked,
    }));
    expect(info.selectedColorId).toBe(4);
    expect(info.placementsCount).toBe(11);
    expect(info.surpriseUnlocked).toBe(true);
    expect(info.sixthVisible).toBe(true);
  });

  test('AC-F5-03: corrupt save is cleared, game still loads', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.evaluate(() =>
      localStorage.setItem('townscaper-mvp-v1', 'not json {{{'),
    );
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    const s = await page.evaluate(() => ({
      cells: window.__game__.state.all().length,
      stored: localStorage.getItem('townscaper-mvp-v1'),
    }));
    expect(s.cells).toBe(0);
    expect(s.stored).toBeNull(); // cleared
  });

  test('AC-F5-04: debounced save — rapid clicks don\'t spam setItem', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('#palette');

    const setItemCount = await page.evaluate(async () => {
      let count = 0;
      const orig = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (k, v) => { count++; return orig(k, v); };

      const s = window.__game__.state;
      for (let i = 0; i < 10; i++) s.setCell(i, 0, 0, { colorId: 1 });
      // Wait a bit less than the 2s debounce — no save yet
      await new Promise((r) => setTimeout(r, 300));
      const mid = count;
      // Flush — triggers one save
      window.__game__.saveState.flush();
      return { mid, after: count };
    });
    expect(setItemCount.mid).toBe(0); // debounce holding
    expect(setItemCount.after).toBe(1);
  });

  test('load is skipped when ?fresh=1', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.evaluate(() => {
      const s = window.__game__.state;
      s.setCell(5, 0, 5, { colorId: 2 });
      window.__game__.saveState.flush();
    });

    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);
    const count = await page.evaluate(() => window.__game__.state.all().length);
    expect(count).toBe(0);
  });

  test('visual snapshot: city survives reload', async ({ page }) => {
    mkdirSync('docs/screenshots', { recursive: true });

    await page.goto('/?fresh=1');
    await page.waitForSelector('#palette');
    // Build a colorful city programmatically (quick deterministic scene)
    await page.evaluate(() => {
      const s = window.__game__.state;
      const picks = [[12,0,12,2],[13,0,12,3],[14,0,12,4],[12,0,13,5],[13,0,13,2],
                     [14,0,13,3],[12,0,14,4],[13,0,14,5],[14,0,14,2],[13,1,13,3],
                     [13,2,13,4]];
      for (const [x,y,z,c] of picks) s.setCell(x, y, z, { colorId: c });
      window.__game__.saveState.flush();
    });

    await page.goto('/'); // reload — load from save
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(500);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'docs/screenshots/T-013-after-reload.png' });
  });
});
