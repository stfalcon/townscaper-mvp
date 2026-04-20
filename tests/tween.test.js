import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TweenManager, linear, easeOutQuad, easeInQuad, easeInOutCubic, easeOutBack,
} from '../src/tween.js';

describe('TweenManager', () => {
  let tm;
  beforeEach(() => { tm = new TweenManager(); });

  it('interpolates from→to over duration with linear easing', () => {
    const values = [];
    tm.start('x', {
      from: 0, to: 100, duration: 100, easing: linear,
      onUpdate: (v) => values.push(v),
    });
    tm.tick(0);   // init: value at t=0
    tm.tick(50);  // halfway
    tm.tick(100); // complete
    expect(values[0]).toBe(0);
    expect(values[1]).toBe(50);
    expect(values[2]).toBe(100);
  });

  it('calls onComplete exactly once and removes the tween', () => {
    const onComplete = vi.fn();
    const onUpdate = vi.fn();
    tm.start('k', {
      from: 0, to: 1, duration: 10, easing: linear, onUpdate, onComplete,
    });
    tm.tick(0);
    tm.tick(10);
    tm.tick(20); // tween already gone
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(tm.has('k')).toBe(false);
  });

  it('start with same key cancels and replaces ongoing tween', () => {
    const firstUpdate = vi.fn();
    const secondUpdate = vi.fn();
    tm.start('k', {
      from: 0, to: 100, duration: 100, easing: linear, onUpdate: firstUpdate,
    });
    tm.tick(0);
    tm.tick(50);
    tm.start('k', {
      from: 999, to: 2000, duration: 100, easing: linear, onUpdate: secondUpdate,
    });
    tm.tick(50);  // startTime reset
    tm.tick(100); // halfway for second tween
    expect(secondUpdate).toHaveBeenCalled();
    // firstUpdate got exactly 2 calls from the first two ticks
    expect(firstUpdate).toHaveBeenCalledTimes(2);
  });

  it('cancel removes a pending tween without firing onComplete', () => {
    const onComplete = vi.fn();
    tm.start('k', {
      from: 0, to: 1, duration: 10, easing: linear, onUpdate: () => {}, onComplete,
    });
    tm.cancel('k');
    tm.tick(100);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('multiple concurrent tweens progress independently', () => {
    const updates = { a: 0, b: 0 };
    tm.start('a', { from: 0, to: 10, duration: 100, easing: linear, onUpdate: (v) => { updates.a = v; } });
    tm.start('b', { from: 0, to: 20, duration: 50, easing: linear, onUpdate: (v) => { updates.b = v; } });
    tm.tick(0);
    tm.tick(50);
    // 'a' halfway: 5. 'b' completes: 20.
    expect(updates.a).toBe(5);
    expect(updates.b).toBe(20);
  });
});

describe('easings', () => {
  it.each([linear, easeOutQuad, easeInQuad, easeInOutCubic, easeOutBack])(
    'all easings return 0 at t=0 and 1 at t=1 (within small tolerance)',
    (fn) => {
      expect(fn(0)).toBeCloseTo(0, 5);
      expect(fn(1)).toBeCloseTo(1, 5);
    },
  );

  it('easeOutBack overshoots past 1.0 near the end', () => {
    // Typical property: peak above 1 around t≈0.85
    const max = Math.max(
      easeOutBack(0.75), easeOutBack(0.8), easeOutBack(0.85), easeOutBack(0.9),
    );
    expect(max).toBeGreaterThan(1);
  });
});
