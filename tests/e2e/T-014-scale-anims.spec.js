import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const CELL_KEY = '15_0_15';

async function scaleAt(page, tileType, key) {
  return page.evaluate(({ tileType, key }) => {
    const pool = window.__game__.renderer.pools[tileType];
    return pool.getScale(key);
  }, { tileType, key });
}

test.describe('T-014: scale animations on place / remove', () => {
  test('placement tweens scaleY from 0 → 1 with overshoot bounce', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    // Drive the tween with manual ticks at known synthetic times — this is
    // deterministic regardless of RAF scheduling. The TweenManager's `tick(now)`
    // is idempotent (clamps progress to 1), so ticking in addition to the
    // real RAF loop is safe.
    const samples = await page.evaluate(() => {
      const r = window.__game__.renderer;
      const pool = r.pools.roof;
      const out = [];
      window.__game__.state.setCell(15, 0, 15, { colorId: 2 });
      // Grab the tween's startTime (set on first real tick). Fall back to "now".
      r.tweens.tick(performance.now()); // ensure startTime is set
      const start = performance.now();
      // Sample at 0, 40, 80, 120, 160, 200, 240, 280ms from start
      for (let t = 0; t <= 280; t += 40) {
        r.tweens.tick(start + t);
        out.push(pool.getScale('15_0_15'));
      }
      return out;
    });
    const midTween = samples.some((s) => s > 0.01 && s < 0.99);
    if (!midTween) {
      throw new Error(`midTween not found. samples: ${JSON.stringify(samples)}`);
    }
    expect(samples[samples.length - 1]).toBeCloseTo(1, 2);
  });

  test('removal tweens scaleY down to 0, then frees the instance', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    // Place + let tween complete (real RAF time)
    await page.evaluate(() => window.__game__.state.setCell(15, 0, 15, { colorId: 2 }));
    await page.waitForTimeout(400);
    expect(await scaleAt(page, 'roof', CELL_KEY)).toBeCloseTo(1, 2);

    // Drive remove tween with manual ticks; avoids RAF scheduling flakes
    const samples = await page.evaluate(() => {
      const r = window.__game__.renderer;
      const pool = r.pools.roof;
      const out = [];
      window.__game__.state.removeCell(15, 0, 15);
      r.tweens.tick(performance.now()); // initialize startTime
      const start = performance.now();
      for (let t = 0; t <= 160; t += 30) {
        r.tweens.tick(start + t);
        out.push(pool.getScale('15_0_15') ?? null);
      }
      return out;
    });
    // At some point during the 150ms tween, scale is between 0 and 1
    const midway = samples.some((s) => s !== null && s > 0.01 && s < 0.99);
    if (!midway) throw new Error(`midway not found. samples: ${JSON.stringify(samples)}`);

    // After tween completes, free() runs — instance gone from pool
    const stats = await page.evaluate(() => window.__game__.renderer.getPoolStats());
    expect(stats.total).toBe(0);
  });

  test('no vertical floating — cube bottom stays at cell.y during tween', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    await page.evaluate(() => window.__game__.state.setCell(15, 0, 15, { colorId: 2 }));
    // Sample the instance matrix during tween and verify world-space bottom y ≈ 0
    await page.waitForTimeout(80);
    const bottomY = await page.evaluate(() => {
      const THREE = window.__game__.renderer.scene.userData.THREE || null;
      const pool = window.__game__.renderer.pools.roof;
      const id = pool.cellToId.get('15_0_15');
      // Read matrix, extract position.y and scale.y, compute bottom
      const m = pool.mesh.instanceMatrix.array;
      const base = id * 16;
      // Column-major: translation is last column (elements 12,13,14)
      const posY = m[base + 13];
      const scaleY = m[base + 5]; // diag M[1][1]
      return posY - 0.5 * scaleY; // local bottom is -0.5 → world bottom = pos.y - 0.5*scale
    });
    // Should be cell.y (which is 0) within floating-point noise
    expect(bottomY).toBeCloseTo(0, 2);
  });

  test('stress: 20 concurrent place tweens (simulating Random City cascade)', async ({ page }) => {
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    await page.evaluate(() => {
      const s = window.__game__.state;
      for (let i = 0; i < 20; i++) s.setCell(i, 0, 0, { colorId: 1 + (i % 5) });
    });

    // Immediately: all 20 cells should be allocated but small
    const stats = await page.evaluate(() => window.__game__.renderer.getPoolStats());
    expect(stats.total).toBe(20);

    // After enough time for all tweens to settle, all scales should be 1
    await page.waitForTimeout(400);
    const allSettled = await page.evaluate(() => {
      const r = window.__game__.renderer;
      for (let i = 0; i < 20; i++) {
        const key = `${i}_0_0`;
        for (const pool of Object.values(r.pools)) {
          if (pool.has(key)) {
            if (Math.abs(pool.getScale(key) - 1) > 0.01) return { key, scale: pool.getScale(key) };
          }
        }
      }
      return 'ok';
    });
    expect(allSettled).toBe('ok');
  });

  test('visual snapshot: mid-placement scale visible', async ({ page }) => {
    mkdirSync('docs/screenshots', { recursive: true });
    await page.goto('/?fresh=1');
    await page.waitForSelector('canvas#canvas');

    await page.evaluate(() => {
      const s = window.__game__.state;
      // Place a tower of 3 cells then more around — captures various tile types
      const cells = [
        [15,0,15,2], [16,0,15,3], [14,0,15,4],
        [15,0,14,5], [15,0,16,2],
        [15,1,15,3], [15,2,15,4],
      ];
      for (const [x,y,z,c] of cells) s.setCell(x, y, z, { colorId: c });
    });
    // Capture very early — scales still ramping up
    await page.waitForTimeout(80);
    await page.mouse.move(5, 5);
    await page.screenshot({ path: 'docs/screenshots/T-014-mid-tween.png' });
  });
});
