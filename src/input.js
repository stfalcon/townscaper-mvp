import * as THREE from 'three';
import { pickWithDDA } from './picking.js';
import { CLICK_THRESHOLD, COLORS } from './constants.js';

const COLOR_BY_ID = Object.fromEntries(COLORS.map((c) => [c.id, c.hex]));

/**
 * Wires pointer events to picking + hover + place/remove.
 *
 * - LMB click: place a cell at placementCoord (build mode) OR remove hit cell
 *   (erase mode).
 * - RMB click: remove the hit cell (any mode). contextmenu is suppressed.
 * - Drag (move ≥8px within click window OR hold ≥300ms): ignored. Prevents
 *   accidental placements from kids' micro-drags (GDD §2).
 * - Hover: outline tracks the pointer; red tint when canPlace fails.
 */
export class InputManager {
  constructor({ canvas, camera, state, renderer }) {
    this.canvas = canvas;
    this.camera = camera;
    this.state = state;
    this.renderer = renderer;

    /** Public tweakable settings (palette/mode UI wires these later). */
    this.currentColorId = 1;
    this.mode = 'build'; // 'build' | 'erase'

    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._lastHoverKey = null;
    this._pointerDown = null;

    this._onMove = this._onMove.bind(this);
    this._onLeave = this._onLeave.bind(this);
    this._onDown = this._onDown.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onContextMenu = (e) => e.preventDefault();

    canvas.addEventListener('pointermove', this._onMove);
    canvas.addEventListener('pointerleave', this._onLeave);
    canvas.addEventListener('pointerdown', this._onDown);
    canvas.addEventListener('pointerup', this._onUp);
    canvas.addEventListener('pointercancel', this._onUp);
    canvas.addEventListener('contextmenu', this._onContextMenu);
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('keydown', this._onKeyDown);
  }

  _onKeyDown(e) {
    // Don't steal keys from form elements (future UI palette/inputs).
    if (e.target && e.target.closest?.('button, input, textarea, select')) return;
    const k = e.key.toLowerCase();
    if (k === 'q') {
      this.renderer.rotateCamera('left');
      e.preventDefault();
    } else if (k === 'e') {
      this.renderer.rotateCamera('right');
      e.preventDefault();
    }
  }

  _onWheel(e) {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * 0.1;
    if (delta !== 0) this.renderer.zoom(delta);
  }

  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this._pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._pointer, this.camera);
    return pickWithDDA(this._raycaster.ray, this.state);
  }

  _onMove(e) {
    const hit = this.pick(e.clientX, e.clientY);
    this._applyHover(hit);
  }

  _applyHover(hit) {
    if (!hit || !hit.placementCoord) {
      this._clearHover();
      return;
    }
    const c = hit.placementCoord;
    const key = `${c.x}_${c.y}_${c.z}`;
    if (key === this._lastHoverKey) return;
    this._lastHoverKey = key;
    const valid = this.state.canPlace(c.x, c.y, c.z).ok;
    const color = COLOR_BY_ID[this.currentColorId] ?? 0xffffff;
    this.renderer.setHover({ ...c, valid, color });
  }

  _onLeave() {
    this._clearHover();
  }

  _clearHover() {
    if (this._lastHoverKey === null) return;
    this._lastHoverKey = null;
    this.renderer.setHover(null);
  }

  _onDown(e) {
    // Focus canvas for keyboard events (shortcuts come in T-011)
    if (this.canvas.focus) this.canvas.focus({ preventScroll: true });
    if (e.pointerId != null && this.canvas.setPointerCapture) {
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* some tests */ }
    }
    this._pointerDown = {
      pointerId: e.pointerId,
      button: e.button,
      x: e.clientX, y: e.clientY,
      t: e.timeStamp,
    };
  }

  _onUp(e) {
    const down = this._pointerDown;
    this._pointerDown = null;
    if (!down) return;
    if (down.pointerId != null && down.pointerId !== e.pointerId) return;

    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    const distance = Math.hypot(dx, dy);
    const duration = e.timeStamp - down.t;
    if (distance > CLICK_THRESHOLD.maxDistance) return;
    if (duration > CLICK_THRESHOLD.maxDuration) return;

    const hit = this.pick(e.clientX, e.clientY);
    if (!hit) return;

    const isRemove = down.button === 2 || this.mode === 'erase';
    if (isRemove) this._doRemove(hit);
    else this._doPlace(hit);

    // After mutation, refresh hover for the same pointer position
    this._lastHoverKey = null;
    this._applyHover(this.pick(e.clientX, e.clientY));
  }

  _doPlace(hit) {
    const c = hit.placementCoord;
    if (!c) return;
    if (!this.state.canPlace(c.x, c.y, c.z).ok) return;
    this.state.setCell(c.x, c.y, c.z, { colorId: this.currentColorId });
  }

  _doRemove(hit) {
    if (!hit.hitCell) return;
    const { x, y, z } = hit.hitCell;
    this.state.removeCell(x, y, z);
  }

  dispose() {
    const c = this.canvas;
    c.removeEventListener('pointermove', this._onMove);
    c.removeEventListener('pointerleave', this._onLeave);
    c.removeEventListener('pointerdown', this._onDown);
    c.removeEventListener('pointerup', this._onUp);
    c.removeEventListener('pointercancel', this._onUp);
    c.removeEventListener('contextmenu', this._onContextMenu);
    c.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('keydown', this._onKeyDown);
  }
}
