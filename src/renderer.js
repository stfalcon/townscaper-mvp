import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  GRID_SIZE, CAMERA, PALETTE, COLORS, TILE_TYPES, MAX_CELLS, ANIM,
} from './constants.js';
import { TweenManager, easeInOutCubic, easeOutQuad, easeOutBack, easeInQuad } from './tween.js';

const BEVEL_RADIUS = 0.10; // 10% — visible at dimetric 30° zoom (frontend review: 0.06 was too subtle)
const BEVEL_SEGMENTS = 2;  // smoothness tradeoff vs vertex count

// Vertex AO gradient — darkens bottom + corners, lightens top.
// Multiplied into instance color via vertexColors:true + instanceColor path.
const AO_BOTTOM = 0.72; // strongest shadow (bottom ground contact)
const AO_EDGE = 0.88;   // medium (side corners, where walls meet)
const AO_TOP = 1.0;     // no shadow (top surface)

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.1;
const ZOOM_DURATION = 150;

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

// ---- tile geometry factories ----
//
// Each cell slot is a 1×1×1 world unit. Instances are positioned at
// (x+0.5, y+0.5, z+0.5). Geometry is centered at origin; translate() is
// relative to that center. Heights differ ≥15% to satisfy T-008 DoD.
//
// Phase 2 (T-PH2-A1): bevel-box via RoundedBoxGeometry. We DON'T use
// ExtrudeGeometry because it bevels both caps symmetrically (would pillow
// the bottom and violate no-gap invariant). Instead: round the box on all
// sides, then FLATTEN bottom vertices to y=-0.5 so cells sit flush on the
// ground and on each other when stacked.

/**
 * Flatten vertices whose y is below the threshold back to y=-0.5.
 * Preserves no-gap invariant (T-008 hotfix). Mutates in place.
 */
function flattenBottom(geometry, threshold = -0.45) {
  const pos = geometry.attributes.position;
  const arr = pos.array;
  for (let i = 1; i < arr.length; i += 3) { // y components
    if (arr[i] < threshold) arr[i] = -0.5;
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals(); // recompute normals after flattening
  return geometry;
}

/**
 * Bake vertex AO as a BufferAttribute('color'). Y-gradient: bottom darkest,
 * top brightest. Per frontend-architect review: must be applied BEFORE pool
 * material sets `vertexColors: true`, and AO lives in geometry (static), not
 * per-instance. Shader chunk multiplies vColor × instanceColor × light —
 * verified in Three.js r160 `<color_vertex>` / `<color_fragment>`.
 */
function applyVertexAO(geometry) {
  const pos = geometry.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    // Map y from [-0.5, top-of-cell] to [AO_BOTTOM, AO_TOP] linearly.
    // Bottom face (y=-0.5) gets AO_BOTTOM. Vertices above y≈0 get closer to AO_TOP.
    // Edge verts (corners, where bevel lives) get AO_EDGE.
    const t = Math.max(0, Math.min(1, (y + 0.5) / 1.0));
    const ao = AO_BOTTOM + (AO_TOP - AO_BOTTOM) * t;
    colors[i * 3] = ao;
    colors[i * 3 + 1] = ao;
    colors[i * 3 + 2] = ao;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Bevelled 1×1×1 box with flat bottom. Per frontend review: RoundedBoxGeometry
 * + flatten bottom is correct approach; ExtrudeGeometry bevels both caps and
 * breaks no-gap invariant.
 */
function makeBevelBox(width = 1, height = 1, depth = 1, radius = BEVEL_RADIUS) {
  const g = new RoundedBoxGeometry(width, height, depth, BEVEL_SEGMENTS, radius);
  flattenBottom(g);
  applyVertexAO(g);
  return g;
}

function makeWallGeometry() {
  return makeBevelBox();
}

function makeFreestandingGeometry() {
  // Same geometry as wall — freestanding's top is always hidden by cell above
  // (hasAbove=true invariant). Differentiation via visual detail deferred.
  return makeBevelBox();
}

function makeCornerGeometry() {
  // Same as wall (gap-avoidance). Visual differentiation deferred.
  return makeBevelBox();
}

function makeRoofGeometry() {
  // Bevelled base (height 0.7) + square pyramid on top (height 0.6).
  // Base uses bevel-box; pyramid stays sharp for classic "roof peak" read.
  // Total height 1.3 (30% over wall — satisfies ≥15% silhouette delta).
  //
  // NOTE: mergeGeometries requires uniform indexed/non-indexed state across
  // inputs. RoundedBoxGeometry is indexed. Convert both to non-indexed first.
  const base = makeBevelBox(1, 0.7, 1);
  base.translate(0, -0.15, 0); // bottom at y=-0.5 (cell bottom), top at y=+0.2
  // Re-bake AO against post-translate positions so the Y-gradient aligns
  // with world-space instead of geometry-local.
  applyVertexAO(base);
  const pyramid = new THREE.ConeGeometry(Math.SQRT1_2, 0.6, 4);
  pyramid.rotateY(Math.PI / 4);
  pyramid.translate(0, 0.5, 0); // apex at y=+0.8 (0.3 above cell top)
  applyVertexAO(pyramid);
  // Normalize both to non-indexed before merge (only convert indexed ones —
  // Three.js warns if you call toNonIndexed on already-non-indexed geometry).
  const baseND = base.index ? base.toNonIndexed() : base;
  const pyramidND = pyramid.index ? pyramid.toNonIndexed() : pyramid;
  return mergeGeometries([baseND, pyramidND]);
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
    this.scales = new Map();   // cellKey → scaleY (for ongoing tweens)
    this.cells = new Map();    // cellKey → cell (keeps position for setScale)
    this.dummy = new THREE.Object3D();
    this._tmpMatrix = new THREE.Matrix4();
  }

  has(key) {
    return this.cellToId.has(key);
  }

  allocate(cell, initialScaleY = 1) {
    const key = cellKey(cell);
    if (this.cellToId.has(key)) return this.cellToId.get(key);

    const id = this.mesh.count;
    this.mesh.count = id + 1;

    this.slots[id] = key;
    this.cellToId.set(key, id);
    this.cells.set(key, cell);
    this.scales.set(key, initialScaleY);
    this.#writeMatrix(id, cell, initialScaleY);

    const [r, g, b] = COLOR_RGB[cell.colorId] ?? [1, 1, 1];
    this.mesh.instanceColor.setXYZ(id, r, g, b);

    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    return id;
  }

  #writeMatrix(id, cell, scaleY) {
    // Keep bottom of the mesh flush with cell.y regardless of scale —
    // all geometries have local bottom at y=-0.5, so world bottom =
    // position.y - 0.5*scaleY. Solving for position.y to pin bottom at cell.y:
    const s = Math.max(scaleY, 0.001); // avoid zero-determinant matrix
    this.dummy.position.set(cell.x + 0.5, cell.y + 0.5 * s, cell.z + 0.5);
    this.dummy.scale.set(1, s, 1);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(id, this.dummy.matrix);
  }

  setScale(key, scaleY) {
    const id = this.cellToId.get(key);
    if (id === undefined) return;
    const cell = this.cells.get(key);
    if (!cell) return;
    this.scales.set(key, scaleY);
    this.#writeMatrix(id, cell, scaleY);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  getScale(key) {
    return this.scales.get(key) ?? 1;
  }

  free(key) {
    const id = this.cellToId.get(key);
    if (id === undefined) return;
    this.cellToId.delete(key);
    this.cells.delete(key);
    this.scales.delete(key);

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

    this.yaw = CAMERA.yaw;
    this.zoomLevel = CAMERA.zoom;
    this.tweens = new TweenManager();

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
    this.camera.zoom = this.zoomLevel;
    this.#updateCameraPosition();
    this.camera.updateProjectionMatrix();
  }

  #updateCameraPosition() {
    const d = CAMERA.distance;
    const c = GRID_SIZE / 2;
    this.camera.position.set(
      c + d * Math.cos(this.yaw) * Math.cos(CAMERA.pitch),
      d * Math.sin(CAMERA.pitch),
      c + d * Math.sin(this.yaw) * Math.cos(CAMERA.pitch),
    );
    this.camera.lookAt(c, 0, c);
  }

  /**
   * Snap yaw by ±90° with eased tween. direction: 'left' | 'right'.
   * Does NOT interrupt in-flight rotation — re-starting the tween keyed by
   * 'camera-yaw' preserves the visual trajectory.
   */
  rotateCamera(direction) {
    const delta = direction === 'left' ? -Math.PI / 2 : Math.PI / 2;
    const from = this.yaw;
    const to = this.yaw + delta;
    this.tweens.start('camera-yaw', {
      from, to,
      duration: ANIM.cameraRotate,
      easing: easeInOutCubic,
      onUpdate: (v) => {
        this.yaw = v;
        this.#updateCameraPosition();
      },
    });
  }

  /**
   * Nudge zoom by delta (typically ±0.1). Clamps to [ZOOM_MIN, ZOOM_MAX].
   * Attempting to scroll past a bound is a no-op (AC-F9-03, AC-F9-04).
   */
  zoom(delta) {
    const target = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoomLevel + delta));
    if (target === this.zoomLevel) return;
    const from = this.camera.zoom;
    this.zoomLevel = target;
    this.tweens.start('camera-zoom', {
      from, to: target,
      duration: ZOOM_DURATION,
      easing: easeOutQuad,
      onUpdate: (v) => {
        this.camera.zoom = v;
        this.camera.updateProjectionMatrix();
      },
    });
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
    // Material uses BOTH vertex colors (vertex AO gradient baked in via
    // applyVertexAO) AND per-instance color (palette). Three.js r160 shader
    // chunk multiplies: finalColor = diffuse × vColor × instanceColor × light.
    // Precondition: geometry MUST have 'color' attribute BEFORE this material
    // is attached to an InstancedMesh (otherwise vColor=0 → black cubes).
    // applyVertexAO() is called in every makeXGeometry — verify if changing.
    const material = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      vertexColors: true,
    });

    const geometries = {
      freestanding: makeFreestandingGeometry(),
      wall: makeWallGeometry(),
      corner: makeCornerGeometry(),
      roof: makeRoofGeometry(),
    };

    this.pools = {};
    for (const tileType of TILE_TYPES) {
      const pool = new InstancePool(tileType, geometries[tileType], material, MAX_CELLS);
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
    if (coord.valid === false) {
      this.hoverMesh.material.color.setHex(0xff4444);
    } else {
      this.hoverMesh.material.color.setHex(coord.color ?? 0xffffff);
    }
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
        // Migrate: cancel any active tween, free from old pool, allocate
        // into target at scale=1 (skip re-tween to avoid "pop-pop" spam
        // on neighbor additions).
        this.tweens.cancel(`scale-${key}`);
        pool.free(key);
        targetPool.allocate(cell, 1);
        return;
      }
    }

    // Fresh cell — allocate at scale 0 and tween up with bounce.
    targetPool.allocate(cell, 0);
    this.tweens.start(`scale-${key}`, {
      from: 0,
      to: 1,
      duration: ANIM.place,
      easing: easeOutBack,
      onUpdate: (s) => targetPool.setScale(key, s),
    });
  }

  #onCellRemoved(cell) {
    const key = cellKey(cell);
    for (const tileType of TILE_TYPES) {
      const pool = this.pools[tileType];
      if (pool.has(key)) {
        // Scale-out tween, then free.
        const from = pool.getScale(key);
        this.tweens.start(`scale-${key}`, {
          from,
          to: 0,
          duration: ANIM.remove,
          easing: easeInQuad,
          onUpdate: (s) => pool.setScale(key, s),
          onComplete: () => pool.free(key),
        });
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

  render(now) {
    this.tweens.tick(now ?? performance.now());
    this.webgl.render(this.scene, this.camera);
  }

  start() {
    const loop = (now) => {
      this.render(now);
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
