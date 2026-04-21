import { test, expect } from '@playwright/test';

test.describe('T-002: GameState module in browser', () => {
  test('module imports and exposes expected API', async ({ page }) => {
    await page.goto('/');
    const api = await page.evaluate(async () => {
      const mod = await import('/src/gameState.js');
      const s = new mod.GameState();
      return {
        hasGameState: typeof mod.GameState === 'function',
        methodTypes: [
          typeof s.getCell, typeof s.canPlace,
          typeof s.setCell, typeof s.removeCell, typeof s.updateTile,
          typeof s.getNeighbors, typeof s.all, typeof s.clear,
          typeof s.toJSON, typeof s.fromJSON,
          typeof s.on, typeof s.off,
        ],
      };
    });
    expect(api.hasGameState).toBe(true);
    expect(api.methodTypes.every((t) => t === 'function')).toBe(true);
  });

  test('end-to-end: place, update tile, save, load round-trip', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const { GameState } = await import('/src/gameState.js');
      const s1 = new GameState();
      const events = [];
      s1.on('cellChanged', (d) => events.push(`ch:${d.op}`));
      s1.on('cellResolved', (d) => events.push(`rs:${d.cell.tileType}`));

      s1.setCell(5, 0, 5, { type: 'land' });
      s1.updateTile(5, 0, 5, 'land');
      s1.setCell(5, 1, 5, { colorId: 2 });
      s1.updateTile(5, 1, 5, 'roof');
      const json = s1.toJSON();

      const s2 = new GameState();
      s2.fromJSON(json);
      const restored = s2.getCell(5, 1, 5);

      return {
        events,
        jsonHasNoTileType: !('tileType' in json.cells[0]),
        restoredColorId: restored?.colorId,
        restoredTileTypeIsNull: restored?.tileType === null,
        totalRestored: s2.all().length,
      };
    });
    expect(result.events).toEqual(['ch:add', 'rs:land', 'ch:add', 'rs:roof']);
    expect(result.jsonHasNoTileType).toBe(true);
    expect(result.restoredColorId).toBe(2);
    expect(result.restoredTileTypeIsNull).toBe(true);
    expect(result.totalRestored).toBe(2);
  });

  test('canPlace rules match TDD §3.2 + land-first rule', async ({ page }) => {
    await page.goto('/');
    const results = await page.evaluate(async () => {
      const { GameState } = await import('/src/gameState.js');
      const s = new GameState();
      s.setCell(5, 0, 5, { type: 'land' });
      return {
        landInBounds: s.canPlace(10, 0, 10, 'land'),
        landAboveZero: s.canPlace(10, 1, 10, 'land'),
        outOfBounds: s.canPlace(-1, 0, 5),
        buildingAtYZero: s.canPlace(10, 0, 10),
        occupiedLand: s.canPlace(5, 0, 5, 'land'),
        noSupport: s.canPlace(15, 5, 15),
        tooHigh: s.canPlace(5, 10, 5),
        buildingOnLand: s.canPlace(5, 1, 5),
      };
    });
    expect(results.landInBounds).toEqual({ ok: true });
    expect(results.landAboveZero).toEqual({ ok: false, reason: 'land-y-must-be-zero' });
    expect(results.outOfBounds).toEqual({ ok: false, reason: 'out-of-bounds' });
    expect(results.buildingAtYZero).toEqual({ ok: false, reason: 'building-needs-land' });
    expect(results.occupiedLand).toEqual({ ok: false, reason: 'occupied' });
    expect(results.noSupport).toEqual({ ok: false, reason: 'no-support' });
    expect(results.tooHigh).toEqual({ ok: false, reason: 'too-high' });
    expect(results.buildingOnLand).toEqual({ ok: true });
  });
});
