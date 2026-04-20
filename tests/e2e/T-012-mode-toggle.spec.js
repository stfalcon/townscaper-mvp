import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test.describe('T-012: mode toggle (Build / Erase) with progressive disclosure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.evaluate(() => localStorage.clear());
  });

  test('mode toggle is HIDDEN on first visit (no placements yet)', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(200);

    const hidden = await page.evaluate(() =>
      document.getElementById('mode-toggle').hidden,
    );
    expect(hidden).toBe(true);
  });

  test('mode toggle becomes visible after first placement (progressive disclosure)', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');
    const v = page.viewportSize();
    await page.mouse.click(Math.floor(v.width / 2), Math.floor(v.height / 2));
    await page.waitForTimeout(150);

    const hidden = await page.evaluate(() =>
      document.getElementById('mode-toggle').hidden,
    );
    expect(hidden).toBe(false);
  });

  test('AC-F2-02: clicking Erase toggle switches to erase mode; LMB removes', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    // Seed a cell + make toggle visible
    await page.evaluate(() => {
      window.__game__.state.setCell(15, 0, 15, { colorId: 2 });
    });
    await page.waitForTimeout(100);

    // Click Erase
    await page.locator('.mode-btn[data-mode="erase"]').click();
    const mode = await page.evaluate(() => window.__game__.input.mode);
    expect(mode).toBe('erase');

    // LMB on the cube should remove it
    const v = page.viewportSize();
    await page.mouse.click(Math.floor(v.width / 2), Math.floor(v.height / 2));
    await page.waitForTimeout(150);
    const total = await page.evaluate(() => window.__game__.state.all().length);
    expect(total).toBe(0);
  });

  test('AC-F1-05: erase-mode LMB on empty → toast + shake feedback', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    // Seed a cell far from center, switch to erase
    await page.evaluate(() => {
      window.__game__.state.setCell(5, 0, 5, { colorId: 2 });
      window.__game__.ui.setMode('erase');
    });
    await page.waitForTimeout(100);

    // Click on a grass cell inside the grid (viewport center — around grid cell (15,0,15))
    const v = page.viewportSize();
    await page.mouse.click(Math.floor(v.width / 2), Math.floor(v.height / 2));
    await page.waitForTimeout(50);

    const info = await page.evaluate(() => ({
      toastCount: document.querySelectorAll('.toast-cursor').length,
      noopCount: window.__game__.ui._noopEraseCount,
    }));
    expect(info.toastCount).toBeGreaterThanOrEqual(1);
    expect(info.noopCount).toBe(1);
  });

  test('3 no-op erase clicks auto-switch back to Build', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    // Seed one cell far from center so center clicks don't hit it
    await page.evaluate(() => {
      window.__game__.state.setCell(5, 0, 5, { colorId: 2 });
      window.__game__.ui.setMode('erase');
    });

    const v = page.viewportSize();
    const cx = Math.floor(v.width / 2);
    const cy = Math.floor(v.height / 2);
    // Three no-op clicks near center (hits grass, inside grid bounds)
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(60);
    await page.mouse.click(cx + 30, cy + 20);
    await page.waitForTimeout(60);
    await page.mouse.click(cx - 30, cy - 20);
    await page.waitForTimeout(120);

    const modeNow = await page.evaluate(() => window.__game__.input.mode);
    expect(modeNow).toBe('build');
  });

  test('successful erase resets no-op counter', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    const v = page.viewportSize();
    const cx = Math.floor(v.width / 2);
    const cy = Math.floor(v.height / 2);

    await page.evaluate(() => {
      // Cube at grid center so center click hits it
      window.__game__.state.setCell(15, 0, 15, { colorId: 2 });
      window.__game__.ui.setMode('erase');
    });

    // 2 no-op clicks on grass away from center
    await page.mouse.click(cx + 150, cy);
    await page.waitForTimeout(50);
    await page.mouse.click(cx - 150, cy);
    await page.waitForTimeout(50);

    // Successful erase on the cube at center
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(80);

    // Counter should be 0; 2 more no-ops → still erase mode (not 3rd)
    await page.mouse.click(cx + 150, cy);
    await page.waitForTimeout(50);
    await page.mouse.click(cx - 150, cy);
    await page.waitForTimeout(80);

    const modeNow = await page.evaluate(() => window.__game__.input.mode);
    expect(modeNow).toBe('erase');
  });

  test('mode toggle selection indicator updates on click', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    await page.evaluate(() => {
      window.__game__.state.setCell(15, 0, 15, { colorId: 2 });
    });

    const initial = await page.evaluate(() => ({
      build: document.querySelector('.mode-btn[data-mode="build"]').dataset.selected,
      erase: document.querySelector('.mode-btn[data-mode="erase"]').dataset.selected,
    }));
    expect(initial).toEqual({ build: 'true', erase: 'false' });

    await page.locator('.mode-btn[data-mode="erase"]').click();
    const after = await page.evaluate(() => ({
      build: document.querySelector('.mode-btn[data-mode="build"]').dataset.selected,
      erase: document.querySelector('.mode-btn[data-mode="erase"]').dataset.selected,
    }));
    expect(after).toEqual({ build: 'false', erase: 'true' });
  });

  test('mode toggle survives reload via saveState', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    await page.evaluate(() => {
      window.__game__.state.setCell(15, 0, 15, { colorId: 2 });
      window.__game__.saveState.flush();
    });

    await page.goto('/'); // load from save
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(300);

    const hidden = await page.evaluate(() =>
      document.getElementById('mode-toggle').hidden,
    );
    expect(hidden).toBe(false); // toggle stays visible after reload
  });

  test('visual snapshot: mode toggle with erase selected', async ({ page }) => {
    mkdirSync('docs/screenshots', { recursive: true });
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    await page.evaluate(() => {
      const s = window.__game__.state;
      const picks = [[12,0,12,2],[13,0,12,3],[14,0,12,4],[12,0,13,5],[13,0,13,2]];
      for (const [x,y,z,c] of picks) s.setCell(x, y, z, { colorId: c });
      window.__game__.ui.setMode('erase');
    });
    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'docs/screenshots/T-012-mode-toggle.png' });
  });
});
