import { describe, it, expect } from 'vitest';
import { canonicalizeKey, hashKey } from '../src/normalization/canonicalize.js';

describe('canonicalizeKey', () => {
  it('treats reordered object keys as equal', () => {
    expect(canonicalizeKey({ a: 1, b: 2 })).toBe(canonicalizeKey({ b: 2, a: 1 }));
  });

  it('treats nested objects with reordered keys as equal', () => {
    const x = { a: { x: 1, y: 2 }, b: [1, 2, 3] };
    const y = { b: [1, 2, 3], a: { y: 2, x: 1 } };
    expect(canonicalizeKey(x)).toBe(canonicalizeKey(y));
  });

  it('handles arrays positionally', () => {
    expect(canonicalizeKey([1, 2, 3])).not.toBe(canonicalizeKey([3, 2, 1]));
    expect(canonicalizeKey([1, 2, 3])).toBe(canonicalizeKey([1, 2, 3]));
  });

  it('handles primitives', () => {
    expect(canonicalizeKey('x')).toBe(canonicalizeKey('x'));
    expect(canonicalizeKey(42)).toBe(canonicalizeKey(42));
    expect(canonicalizeKey(true)).toBe(canonicalizeKey(true));
    expect(canonicalizeKey(null)).toBe(canonicalizeKey(null));
    expect(canonicalizeKey(undefined)).toBe(canonicalizeKey(undefined));
  });

  it('distinguishes a string "1" from the number 1', () => {
    expect(canonicalizeKey('1')).not.toBe(canonicalizeKey(1));
  });

  it('does not throw on circular references', () => {
    const a: Record<string, unknown> = { name: 'root' };
    a.self = a;
    const b: Record<string, unknown> = { name: 'root' };
    b.self = b;
    expect(() => canonicalizeKey(a)).not.toThrow();
    expect(canonicalizeKey(a)).toBe(canonicalizeKey(b));
  });

  it('distinguishes different circular structures', () => {
    const a: Record<string, unknown> = { a: 1 };
    a.self = a;
    const b: Record<string, unknown> = { a: 2 };
    b.self = b;
    expect(canonicalizeKey(a)).not.toBe(canonicalizeKey(b));
  });

  it('produces a stable key across repeated calls', () => {
    const value = { z: 1, a: { nested: true } };
    expect(canonicalizeKey(value)).toBe(canonicalizeKey(value));
  });

  it('treats deeply nested structures correctly', () => {
    const deep = { a: { b: { c: { d: { e: 1 } } } } };
    const reordered = { a: { b: { c: { d: { e: 1 } } } } };
    expect(canonicalizeKey(deep)).toBe(canonicalizeKey(reordered));
  });

  it('handles unicode arguments without mangling them', () => {
    expect(canonicalizeKey({ q: 'café ☕' })).toBe(canonicalizeKey({ q: 'café ☕' }));
    expect(canonicalizeKey({ q: 'café' })).not.toBe(canonicalizeKey({ q: 'cafe' }));
  });

  it('handles arrays containing objects with reordered keys', () => {
    expect(canonicalizeKey([{ a: 1, b: 2 }])).toBe(canonicalizeKey([{ b: 2, a: 1 }]));
  });

  it('does not collapse shared (non-circular) references into a false cycle', () => {
    // Regression: v3 used one global `seen` set, so a value referenced twice in
    // sibling positions was marked circular and compared equal to a structure
    // that genuinely differed.
    const shared = { value: 42 };
    const withShared = { first: shared, second: shared };
    const withTwoDistinct = { first: { value: 42 }, second: { value: 42 } };

    // Structurally identical -> same key (this is desired).
    expect(canonicalizeKey(withShared)).toBe(canonicalizeKey(withTwoDistinct));

    // But a shared reference must not be mistaken for a cycle: the key must
    // contain the shared value twice.
    expect(canonicalizeKey(withShared)).toContain('42');
    expect(canonicalizeKey(withShared)).not.toContain('__circular__');
  });

  it('distinguishes a genuinely circular value from a shared one', () => {
    const circular: Record<string, unknown> = { value: 42 };
    circular.self = circular;
    const shared = { value: 42 };

    expect(canonicalizeKey(circular)).not.toBe(canonicalizeKey(shared));
    expect(canonicalizeKey(circular)).toContain('__circular__');
  });

  it('handles NaN and Infinity deterministically', () => {
    expect(canonicalizeKey(NaN)).toBe(canonicalizeKey(NaN));
    expect(canonicalizeKey(Infinity)).toBe(canonicalizeKey(Infinity));
    expect(canonicalizeKey(-Infinity)).toBe(canonicalizeKey(-Infinity));
    expect(canonicalizeKey(NaN)).not.toBe(canonicalizeKey(Infinity));
  });

  it('normalizes -0 to 0', () => {
    expect(canonicalizeKey(-0)).toBe(canonicalizeKey(0));
  });

  it('handles Date instances', () => {
    const d = new Date('2024-01-01T00:00:00.000Z');
    expect(canonicalizeKey({ d })).toBe(canonicalizeKey({ d: new Date('2024-01-01T00:00:00.000Z') }));
    expect(canonicalizeKey({ d })).not.toBe(canonicalizeKey({ d: new Date('2025-01-01T00:00:00.000Z') }));
  });

  it('handles Map and Set instances', () => {
    expect(canonicalizeKey(new Map([['a', 1]]))).toBe(canonicalizeKey(new Map([['a', 1]])));
    expect(canonicalizeKey(new Set([1, 2]))).toBe(canonicalizeKey(new Set([2, 1])));
  });

  it('survives pathological nesting depth', () => {
    let deep: unknown = 1;
    for (let i = 0; i < 500; i += 1) deep = { deep };
    expect(() => canonicalizeKey(deep)).not.toThrow();
  });

  it('treats functions as undefined rather than crashing', () => {
    expect(canonicalizeKey({ fn: () => 1 })).toBe(canonicalizeKey({ fn: undefined }));
  });
});

describe('hashKey', () => {
  it('is deterministic', () => {
    expect(hashKey('abc')).toBe(hashKey('abc'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashKey('abc')).not.toBe(hashKey('abd'));
  });

  it('returns a short string', () => {
    expect(hashKey('a'.repeat(10_000)).length).toBeLessThan(16);
  });
});
