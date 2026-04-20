import { describe, it, expect } from 'vitest';

describe('infrastructure smoke test', () => {
  it('test runner works', () => {
    expect(1 + 1).toBe(2);
  });

  it('ES modules work', () => {
    const mod = { foo: 'bar' };
    const { foo } = mod;
    expect(foo).toBe('bar');
  });
});
