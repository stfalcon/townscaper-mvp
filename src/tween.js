/**
 * Central tween manager. Single RAF loop driven from Renderer.render() —
 * avoids per-tween requestAnimationFrame which causes uncoalesced buffer
 * uploads during many-concurrent tweens (e.g. Random City cascade in T-016).
 *
 * Tweens are keyed: start(key, ...) cancels any running tween with the
 * same key. Use cellKey for per-cell scale tweens, or stable names like
 * 'camera-yaw' for singleton tweens.
 */
export class TweenManager {
  constructor() {
    this._tweens = new Map();
  }

  start(key, { from, to, duration, easing = linear, onUpdate, onComplete }) {
    this._tweens.set(key, {
      from, to, duration, easing, onUpdate, onComplete, startTime: null,
    });
  }

  cancel(key) {
    return this._tweens.delete(key);
  }

  has(key) {
    return this._tweens.has(key);
  }

  clear() {
    this._tweens.clear();
  }

  tick(now) {
    const done = [];
    for (const [key, t] of this._tweens) {
      if (t.startTime == null) t.startTime = now;
      const progress = Math.min((now - t.startTime) / t.duration, 1);
      const value = t.from + (t.to - t.from) * t.easing(progress);
      t.onUpdate(value);
      if (progress >= 1) done.push(key);
    }
    for (const key of done) {
      const t = this._tweens.get(key);
      this._tweens.delete(key);
      t.onComplete?.();
    }
  }

  get size() {
    return this._tweens.size;
  }
}

// --- Easings (power of 2 = 4) ---

export const linear = (t) => t;

export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);

export const easeInQuad = (t) => t * t;

export const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** easeOutBack with default overshoot c1 ≈ 1.7 (matches GDD §5 bounce). */
export const easeOutBack = (t, overshoot = 1.70158) => {
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
};
