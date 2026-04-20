import * as THREE from 'three';
import {
  GRID_SIZE, CAMERA, PALETTE, COLORS, TILE_TYPES, MAX_CELLS,
} from './constants.js';

const COLOR_RGB = Object.fromEntries(
  COLORS.map((c) => [c.id, [
    ((c.hex >> 16) & 0xff) / 255,
    ((c.hex >> 8) & 0xff) / 255,
    (c.hex & 0xff) / 255,
  ]]),
);

function cellKey(cell) {
  return `${cell.x}_${cell.y}_${cell.z}`;
}

/**
 * One InstancedMesh + per-instance color attribute for cells of a single tileType.
 * Uses swap-remove on free() to keep the pool compact → draw calls proportional
 * to visible instances, not peak.
 */
class InstancePool {
  constructor(tileType, geometry, material, maxInstances) {
    this.tileType = tileType;
    this.mesh = new THREE.InstancedMesh(geometry, material, maxInstances);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false; // recomputing bounds per frame isn't worth it at 30×30
    const colorArr = new Float32Array(maxInstances * 3);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArr, 3);

    this.slots = new Array(maxInstances).fill(null); // id → cellKey
    this.cellToId = new Map(); // cellKey → id
    this.dummy = new THREE.Object3D();
    this._tmpMatrix = new THREE.Matrix4();
  }

  has(key) {
    return this.cellToId.has(key);
  }

  allocate(cell) {
    const key = cellKey(cell);
    if (this.cellToId.has(key)) return this.cellToId.get(key);

    const id = this.mesh.count;
    this.mesh.count = id + 1;

    this.dummy.position.set(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5);
    this.dummy.scale.set(1, 1, 1);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(id, this.dummy.matrix);

    const [r, g, b] = COLOR_RGB[cell.colorId] ?? [1, 1, 1];
    this.mesh.instanceColor.setXYZ(id, r, g, b);

    this.slots[id] = key;
    this.cellToId.set(key, id);

    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    return id;
  }

  free(key) {
    const id = this.cellToId.get(key);
    if (id === undefined) return;
    this.cellToId.delete(key);

    const lastId = this.mesh.count - 1;
    if (id !== lastId) {
      const lastKey = this.slots[lastId];

      this.mesh.getMatrixAt(lastId, this._tmpMatrix);
      this.mesh.setMatrixAt(id, this._tmpMatrix);

      const lr = this.mesh.instanceColor.getX(lastId);
      const lg = this.mesh.instanceColor.getY(lastId);
      const lb = this.mesh.instanceColor.getZ(lastId);
      this.mesh.instanceColor.setXYZ(id, lr, lg, lb);

      this.slots[id] = lastKey;
      if (lastKey) this.cellToId.set(lastKey, id);
    }
    this.slots[lastId] = null;
    this.mesh.count = lastId;

    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  updateColor(key, colorId) {
    const id = this.cellToId.get(key);
    if (id === undefined) return;
    const [r, g, b] = COLOR_RGB[colorId] ?? [1, 1, 1];
    this.mesh.instanceColor.setXYZ(id, r, g, b);
    this.mesh.instanceColor.needsUpdate = true;
  }

  get size() {
    return this.cellToId.size;
  }
}

export class Renderer {
  constructor(canvas, state) {
    this.canvas = canvas;
    this.state = state;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.skyTop);

    this.#setupCamera();
    this.#setupLights();
    this.#setupGround();
    this.#setupPools();
    this.#setupHover();

    this.webgl = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance',
    });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.#resize();
    this.onResize = () => this.#resize();
    window.addEventListener('resize', this.onResize);

    this.#wireState();
  }

  #setupCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    const v = CAMERA.viewSize;
    this.camera = new THREE.OrthographicCamera(
      -v * aspect, v * aspect, v, -v, 0.1, 1000,
    );
    const d = CAMERA.distance;
    const c = GRID_SIZE / 2;
    this.camera.position.set(
      c + d * Math.cos(CAMERA.yaw) * Math.cos(CAMERA.pitch),
      d * Math.sin(CAMERA.pitch),
      c + d * Math.sin(CAMERA.yaw) * Math.cos(CAMERA.pitch),
    );
    this.camera.lookAt(c, 0, c);
  }

  #setupLights() {
    this.scene.add(new THREE.AmbientLight(PALETTE.lightAmbient, 0.5));
    const dir = new THREE.DirectionalLight(PALETTE.lightDirectional, 0.9);
    dir.position.set(5, 10, 3);
    this.scene.add(dir);
    this.scene.add(new THREE.HemisphereLight(PALETTE.skyTop, PALETTE.grass, 0.4));
  }

  #setupGround() {
    const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
    const mat = new THREE.MeshLambertMaterial({ color: PALETTE.grass });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(GRID_SIZE / 2, 0, GRID_SIZE / 2);
    this.scene.add(ground);
  }

  #setupPools() {
    // All tileTypes share the same cube geometry for T-005.
    // T-008 will give each type a distinct geometry.
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    // Material color stays white — instanceColor (per-instance) is multiplied in.
    // DO NOT set vertexColors: true — that expects geometry.attributes.color and
    // conflicts with the instanceColor path, rendering cubes black.
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff });

    this.pools = {};
    for (const tileType of TILE_TYPES) {
      const pool = new InstancePool(tileType, geometry, material, MAX_CELLS);
      this.pools[tileType] = pool;
      this.scene.add(pool.mesh);
    }
  }

  #setupHover() {
    const geo = new THREE.BoxGeometry(1.04, 1.04, 1.04);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      wireframe: true,
      depthTest: false,
    });
    this.hoverMesh = new THREE.Mesh(geo, mat);
    this.hoverMesh.visible = false;
    this.hoverMesh.renderOrder = 100;
    this.scene.add(this.hoverMesh);
  }

  setHover(coord) {
    if (!coord) {
      this.hoverMesh.visible = false;
      return;
    }
    this.hoverMesh.position.set(coord.x + 0.5, coord.y + 0.5, coord.z + 0.5);
    this.hoverMesh.material.color.setHex(coord.valid === false ? 0xff4444 : 0xffffff);
    this.hoverMesh.visible = true;
  }

  #wireState() {
    // priority=2: runs AFTER TileResolver (priority=1), so tileType is set
    this.state.on('cellResolved', ({ cell }) => this.#onCellResolved(cell), 2);

    // priority=3: cleanup on remove / clear
    this.state.on('cellChanged', (e) => {
      if (e.op === 'remove') this.#onCellRemoved(e.cell);
      else if (e.op === 'clear') this.#onCleared();
    }, 3);
  }

  #onCellResolved(cell) {
    const key = cellKey(cell);
    const targetPool = this.pools[cell.tileType];
    if (!targetPool) return;

    // Check if already in some pool
    for (const tileType of TILE_TYPES) {
      const pool = this.pools[tileType];
      if (pool.has(key)) {
        if (tileType === cell.tileType) {
          // Same pool — just color may have changed
          pool.updateColor(key, cell.colorId);
          return;
        }
        // Migrate: remove from old pool, add to new
        pool.free(key);
        break;
      }
    }
    targetPool.allocate(cell);
  }

  #onCellRemoved(cell) {
    const key = cellKey(cell);
    for (const tileType of TILE_TYPES) {
      const pool = this.pools[tileType];
      if (pool.has(key)) {
        pool.free(key);
        return;
      }
    }
  }

  #onCleared() {
    for (const tileType of TILE_TYPES) {
      const pool = this.pools[tileType];
      pool.mesh.count = 0;
      pool.cellToId.clear();
      pool.slots.fill(null);
      pool.mesh.instanceMatrix.needsUpdate = true;
      pool.mesh.instanceColor.needsUpdate = true;
    }
  }

  /** Dev: inspect pool sizes (used by E2E + stats overlay) */
  getPoolStats() {
    const stats = {};
    for (const tileType of TILE_TYPES) {
      stats[tileType] = this.pools[tileType].size;
    }
    stats.total = Object.values(stats).reduce((a, b) => a + b, 0);
    return stats;
  }

  #resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    const v = CAMERA.viewSize;
    this.camera.left = -v * aspect;
    this.camera.right = v * aspect;
    this.camera.top = v;
    this.camera.bottom = -v;
    this.camera.updateProjectionMatrix();
    this.webgl.setSize(w, h, false);
  }

  render() {
    this.webgl.render(this.scene, this.camera);
  }

  start() {
    const loop = () => {
      this.render();
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  dispose() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    window.removeEventListener('resize', this.onResize);
    for (const tileType of TILE_TYPES) {
      this.pools[tileType].mesh.geometry.dispose();
      this.pools[tileType].mesh.material.dispose();
    }
    this.webgl.dispose();
  }
}
