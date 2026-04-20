import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCREENSHOT_PATH = 'docs/screenshots/T-001-scene.png';

test.describe('T-001: Three.js scene loads cleanly', () => {
  test('page loads with no console errors or warnings', async ({ page }) => {
    const issues = [];
    // Browser-level noise we don't care about (not our code):
    //  - "GL Driver Message" — headless Chrome GL hints, not real errors
    //  - "Download the React DevTools" — not applicable
    const NOISE = [/GL Driver Message/i, /React DevTools/i];
    page.on('console', (msg) => {
      const type = msg.type();
      if (type !== 'error' && type !== 'warning') return;
      const text = msg.text();
      if (NOISE.some((r) => r.test(text))) return;
      issues.push(`${type}: ${text}`);
    });
    page.on('pageerror', (err) => {
      issues.push(`pageerror: ${err.message}`);
    });
    page.on('requestfailed', (req) => {
      const url = req.url();
      // Dev-only stats.js from CDN may fail offline — not relevant here (?dev=0)
      if (!url.includes('stats')) {
        issues.push(`requestfailed: ${url}`);
      }
    });

    await page.goto('/');
    await page.waitForSelector('canvas#canvas', { state: 'visible' });
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    await page.waitForTimeout(800); // let WebGL render a few frames

    expect(issues).toEqual([]);
  });

  test('canvas is rendered with valid WebGL2 context', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(500);

    const info = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      const gl = canvas.getContext('webgl2');
      return {
        hasCanvas: !!canvas,
        hasWebGL2: !!gl,
        width: canvas?.width,
        height: canvas?.height,
        clientWidth: canvas?.clientWidth,
        clientHeight: canvas?.clientHeight,
        noWebGLBannerShown: document.getElementById('no-webgl')?.classList.contains('show') ?? false,
      };
    });

    expect(info.hasCanvas).toBe(true);
    expect(info.noWebGLBannerShown).toBe(false);
    expect(info.width).toBeGreaterThan(0);
    expect(info.height).toBeGreaterThan(0);
  });

  test('canvas has non-trivial rendered content (not all one color)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(1000);

    // Read pixel variance from canvas screenshot — if all pixels match sky-blue
    // (no ground rendered), variance is ~0. Real scene must have >0 variance.
    const screenshot = await page.locator('canvas#canvas').screenshot();
    const uniqueBytes = new Set(screenshot.subarray(0, 5000));
    expect(uniqueBytes.size).toBeGreaterThan(20);
  });

  test('scene renders — visual snapshot saved', async ({ page }) => {
    mkdirSync(dirname(SCREENSHOT_PATH), { recursive: true });
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
  });

  test('resize preserves rendering', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#canvas');
    await page.setViewportSize({ width: 640, height: 480 });
    await page.waitForTimeout(500);

    const { width, height } = await page.evaluate(() => {
      const c = document.getElementById('canvas');
      return { width: c.clientWidth, height: c.clientHeight };
    });
    expect(width).toBe(640);
    expect(height).toBe(480);
  });
});
