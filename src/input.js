import * as THREE from 'three';
import { pickWithDDA } from './picking.js';

/**
 * Wires pointer events to picking + hover feedback.
 * Placement/removal logic lands in T-007.
 */
export class InputManager {
  constructor({ canvas, camera, state, renderer }) {
    this.canvas = canvas;
    this.camera = camera;
    this.state = state;
    this.renderer = renderer;
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._lastHoverKey = null;

    this._onMove = this._onMove.bind(this);
    this._onLeave = this._onLeave.bind(this);
    canvas.addEventListener('pointermove', this._onMove);
    canvas.addEventListener('pointerleave', this._onLeave);
  }

  /** Project clientX/Y into a ray and DDA-pick. */
  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this._pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._pointer, this.camera);
    return pickWithDDA(this._raycaster.ray, this.state);
  }

  _onMove(e) {
    const hit = this.pick(e.clientX, e.clientY);
    if (!hit || !hit.placementCoord) {
      this._clearHover();
      return;
    }
    const c = hit.placementCoord;
    const key = `${c.x}_${c.y}_${c.z}`;
    if (key === this._lastHoverKey) return; // no-op for same cell
    this._lastHoverKey = key;
    const valid = this.state.canPlace(c.x, c.y, c.z).ok;
    this.renderer.setHover({ ...c, valid });
  }

  _onLeave() {
    this._clearHover();
  }

  _clearHover() {
    if (this._lastHoverKey === null) return;
    this._lastHoverKey = null;
    this.renderer.setHover(null);
  }

  dispose() {
    this.canvas.removeEventListener('pointermove', this._onMove);
    this.canvas.removeEventListener('pointerleave', this._onLeave);
  }
}
