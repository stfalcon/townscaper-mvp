import { GameState } from './gameState.js';
import { TileResolver } from './tileResolver.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { UI } from './ui.js';
import { COLORS, GRID_SIZE, MAX_HEIGHT } from './constants.js';

const canvas = document.getElementById('canvas');
if (!canvas) throw new Error('Canvas element #canvas not found');

const params = new URLSearchParams(window.location.search);

// --- Init order per TDD §10 ---
const state = new GameState();
const resolver = new TileResolver(state);   // priority=1
const renderer = new Renderer(canvas, state); // priority=2, 3
const input = new InputManager({ canvas, camera: renderer.camera, state, renderer });
const ui = new UI({ state, input });
renderer.start();

// Expose for DevTools inspection
window.__game__ = { state, resolver, renderer, input, ui };

// --- Dev helpers ---
if (params.has('dev')) loadDevTools();

if (params.has('spawn')) {
  const n = Math.min(parseInt(params.get('spawn'), 10) || 100, 2000);
  const mode = params.get('mode') ?? 'cluster';
  spawnCells(state, n, mode);
}

function spawnCells(state, n, mode) {
  if (mode === 'cluster') {
    // BFS-like cluster near center: denser, more re-tiles (worst case for perf)
    const queue = [{ x: Math.floor(GRID_SIZE / 2), y: 0, z: Math.floor(GRID_SIZE / 2) }];
    const visited = new Set();
    let placed = 0;
    while (queue.length && placed < n) {
      const { x, y, z } = queue.shift();
      const k = `${x}_${y}_${z}`;
      if (visited.has(k)) continue;
      visited.add(k);
      if (!state.canPlace(x, y, z).ok) continue;
      const colorId = 1 + Math.floor(Math.random() * 5);
      state.setCell(x, y, z, { colorId });
      placed++;
      // Push neighbors randomly
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) {
        if (Math.random() < 0.75) queue.push({ x: x + dx, y: y + dy, z: z + dz });
      }
    }
    console.info(`[dev] spawned ${placed} cells (cluster mode)`);
  } else {
    // 'random': scattered cells at y=0
    let placed = 0;
    let attempts = 0;
    while (placed < n && attempts < n * 10) {
      const x = Math.floor(Math.random() * GRID_SIZE);
      const z = Math.floor(Math.random() * GRID_SIZE);
      if (state.canPlace(x, 0, z).ok) {
        state.setCell(x, 0, z, { colorId: 1 + Math.floor(Math.random() * 5) });
        placed++;
      }
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
