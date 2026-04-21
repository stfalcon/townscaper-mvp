import { GameState } from './gameState.js';
import { TileResolver } from './tileResolver.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { UI } from './ui.js';
import { SaveState } from './saveState.js';
import { COLORS, GRID_SIZE, MAX_HEIGHT } from './constants.js';

const canvas = document.getElementById('canvas');
if (!canvas) throw new Error('Canvas element #canvas not found');

const params = new URLSearchParams(window.location.search);

// --- Init order per TDD §10 ---
const state = new GameState();
const resolver = new TileResolver(state);   // priority=1
const renderer = new Renderer(canvas, state); // priority=2, 3
const saveState = new SaveState({ state, resolver, ui: null }); // priority=6 — ui wired below
const input = new InputManager({ canvas, camera: renderer.camera, state, renderer, saveState });
const ui = new UI({ state, input });           // priority=5
saveState.ui = ui;
saveState.attach();

// Restore previous session BEFORE rendering starts to avoid flicker.
// Allow ?fresh=1 or ?spawn=N to skip load (for dev / demo snapshots).
if (!params.has('fresh') && !params.has('spawn')) {
  saveState.load();
}

renderer.start();

// Expose for DevTools inspection
window.__game__ = { state, resolver, renderer, input, ui, saveState };

// --- Dev helpers ---
if (params.has('dev')) loadDevTools();

if (params.has('spawn')) {
  const n = Math.min(parseInt(params.get('spawn'), 10) || 100, 2000);
  const mode = params.get('mode') ?? 'cluster';
  spawnCells(state, n, mode);
}

function spawnCells(state, n, mode) {
  // Helper: place via real canPlace so spawn respects land-first rule.
  const tryPlace = (x, y, z) => {
    if (y === 0) {
      if (!state.canPlace(x, 0, z, 'land').ok) return false;
      state.setCell(x, 0, z, { type: 'land' });
      return true;
    }
    if (!state.canPlace(x, y, z).ok) return false;
    state.setCell(x, y, z, { colorId: 1 + Math.floor(Math.random() * 5), type: 'building' });
    return true;
  };

  if (mode === 'cluster') {
    const queue = [{ x: Math.floor(GRID_SIZE / 2), y: 0, z: Math.floor(GRID_SIZE / 2) }];
    const visited = new Set();
    let placed = 0;
    while (queue.length && placed < n) {
      const { x, y, z } = queue.shift();
      const k = `${x}_${y}_${z}`;
      if (visited.has(k)) continue;
      visited.add(k);
      if (!tryPlace(x, y, z)) continue;
      placed++;
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) {
        if (Math.random() < 0.75) queue.push({ x: x + dx, y: y + dy, z: z + dz });
      }
    }
    console.info(`[dev] spawned ${placed} cells (cluster mode)`);
  } else {
    // 'random': scattered land cells at y=0
    let placed = 0;
    let attempts = 0;
    while (placed < n && attempts < n * 10) {
      const x = Math.floor(Math.random() * GRID_SIZE);
      const z = Math.floor(Math.random() * GRID_SIZE);
      if (tryPlace(x, 0, z)) placed++;
      attempts++;
    }
    console.info(`[dev] spawned ${placed} cells (random mode)`);
  }
}

function loadDevTools() {
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/stats.js@0.17.0/build/stats.min.js';
  s.onload = () => {
    const stats = new window.Stats();
    stats.showPanel(0);
    stats.dom.style.cssText = 'position:fixed;top:8px;left:8px;z-index:100';
    document.body.appendChild(stats.dom);

    const origRender = renderer.render.bind(renderer);
    renderer.render = () => {
      stats.begin();
      origRender();
      stats.end();
    };
  };
  document.head.appendChild(s);
}
