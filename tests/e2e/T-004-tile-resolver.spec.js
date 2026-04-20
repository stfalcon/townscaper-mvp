import { test, expect } from '@playwright/test';

test('T-004: TileResolver orchestrates re-tile in browser', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { GameState } = await import('/src/gameState.js');
    const { TileResolver } = await import('/src/tileResolver.js');
    const state = new GameState();
    new TileResolver(state);

    // Place: (5,0,5) alone → roof
    state.setCell(5, 0, 5, { colorId: 1 });
    const first = state.getCell(5, 0, 5).tileType;

    // Stack: (5,1,5) — now (5,0,5) should become freestanding
    state.setCell(5, 1, 5, { colorId: 1 });
    const lower = state.getCell(5, 0, 5).tileType;
    const upper = state.getCell(5, 1, 5).tileType;

    return { first, lower, upper };
  });
  expect(result).toEqual({
    first: 'roof',
    lower: 'freestanding', // hasAbove=true, horizontal=0
    upper: 'roof',         // no cell above the top
  });
});

test('T-004: resolveAll rehydrates tileType after fromJSON', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { GameState } = await import('/src/gameState.js');
    const { TileResolver } = await import('/src/tileResolver.js');

    const state1 = new GameState();
    new TileResolver(state1);
    state1.setCell(0, 0, 0, { colorId: 1 });
    state1.setCell(1, 0, 0, { colorId: 1 });
    state1.setCell(0, 1, 0, { colorId: 1 });

    const json = state1.toJSON();

    const state2 = new GameState();
    const r2 = new TileResolver(state2);
    state2.fromJSON(json);
    // Before resolveAll — tileType null (not persisted)
    const beforeResolve = state2.getCell(0, 0, 0).tileType;
    r2.resolveAll();
    const afterResolve = state2.getCell(0, 0, 0).tileType;
    return { beforeResolve, afterResolve };
  });
  expect(result.beforeResolve).toBeNull();
  expect(result.afterResolve).toBe('corner'); // hasAbove + 1 horizontal
});
