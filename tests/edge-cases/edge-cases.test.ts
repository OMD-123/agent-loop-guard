import { describe, it, expect } from 'vitest';
import { canonicalizeKey } from '../../src/normalization/canonicalize.js';
import { LoopChecker } from '../../src/checkers/LoopChecker.js';
import { Guardrail } from '../../src/core/Guardrail.js';
import { tool } from '../_helpers.js';

describe('edge case: circular references', () => {
  it('handles a self-referencing object', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;

    const result = canonicalizeKey(obj);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);

    const obj2: Record<string, unknown> = { a: 1 };
    obj2.self = obj2;
    expect(canonicalizeKey(obj2)).toBe(result);
  });

  it('handles a circular reference in a nested object', () => {
    const obj: Record<string, unknown> = { a: { b: 2 } };
    (obj.a as Record<string, unknown>).parent = obj;

    const result = canonicalizeKey(obj);
    expect(typeof result).toBe('string');

    const obj2: Record<string, unknown> = { a: { b: 2 } };
    (obj2.a as Record<string, unknown>).parent = obj2;
    expect(canonicalizeKey(obj2)).toBe(result);
  });

  it('handles a circular array', () => {
    const arr: unknown[] = [1, 2];
    arr.push(arr);

    const result = canonicalizeKey({ data: arr });
    expect(typeof result).toBe('string');

    const arr2: unknown[] = [1, 2];
    arr2.push(arr2);
    expect(canonicalizeKey({ data: arr2 })).toBe(result);
  });

  it('handles a complex circular structure', () => {
    const obj1: Record<string, unknown> = { name: 'obj1' };
    const obj2: Record<string, unknown> = { name: 'obj2' };
    obj1.ref = obj2;
    obj2.ref = obj1;

    const result = canonicalizeKey({ obj1, obj2 });
    expect(typeof result).toBe('string');

    const obj1b: Record<string, unknown> = { name: 'obj1' };
    const obj2b: Record<string, unknown> = { name: 'obj2' };
    obj1b.ref = obj2b;
    obj2b.ref = obj1b;
    expect(canonicalizeKey({ obj1: obj1b, obj2: obj2b })).toBe(result);
  });

  it('treats different circular structures as different', () => {
    const obj1: Record<string, unknown> = { a: 1 };
    obj1.self = obj1;

    const obj2: Record<string, unknown> = { a: 2 };
    obj2.self = obj2;

    expect(canonicalizeKey(obj1)).not.toBe(canonicalizeKey(obj2));
  });

  it('handles mixed circular and normal data', () => {
    const obj: Record<string, unknown> = { normal: 'value', count: 42 };
    obj.circular = obj;

    const result = canonicalizeKey(obj);
    expect(result).toContain('normal');
    expect(result).toContain('value');
    expect(result).toContain('count');
    expect(result).toContain('42');
  });

  it('does not throw when the checker sees circular args', () => {
    const checker = new LoopChecker({ maxRepeatedCalls: 2 });
    const args: Record<string, unknown> = { x: 1 };
    args.self = args;

    expect(() => checker.check(tool('t', args), [])).not.toThrow();
  });
});

describe('edge case: deep nesting', () => {
  it('handles deeply nested arguments', () => {
    let deep: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 50; i += 1) deep = { nested: deep };

    expect(() => canonicalizeKey(deep)).not.toThrow();
  });

  it('handles deeply nested arrays', () => {
    let deep: unknown[] = [1];
    for (let i = 0; i < 50; i += 1) deep = [deep];

    expect(() => canonicalizeKey(deep)).not.toThrow();
  });

  it('still detects repetition with deeply nested args', () => {
    const guard = new Guardrail([
      new LoopChecker({ maxRepeatedCalls: 2, detectCycles: false }),
    ]);
    guard.start();

    const makeArgs = () => ({ a: { b: { c: { d: { e: 1 } } } } });
    guard.check(tool('api', makeArgs()));
    guard.check(tool('api', makeArgs()));

    expect(guard.check(tool('api', makeArgs())).allowed).toBe(false);
  });
});

describe('edge case: unicode arguments', () => {
  it('handles unicode tool arguments', () => {
    expect(canonicalizeKey({ q: 'café ☕' })).toBe(canonicalizeKey({ q: 'café ☕' }));
  });

  it('distinguishes different unicode values', () => {
    expect(canonicalizeKey({ q: 'café' })).not.toBe(canonicalizeKey({ q: 'cafe' }));
  });

  it('distinguishes emoji', () => {
    expect(canonicalizeKey({ q: '🚀' })).not.toBe(canonicalizeKey({ q: '🛸' }));
  });

  it('handles surrogate pairs', () => {
    expect(canonicalizeKey({ q: '👨‍👩‍👧‍👦' })).toBe(canonicalizeKey({ q: '👨‍👩‍👧‍👦' }));
  });

  it('handles RTL text', () => {
    expect(canonicalizeKey({ q: 'مرحبا' })).toBe(canonicalizeKey({ q: 'مرحبا' }));
  });

  it('detects repetition with unicode args', () => {
    const guard = new Guardrail([
      new LoopChecker({ maxRepeatedCalls: 2, detectCycles: false }),
    ]);
    guard.start();

    guard.check(tool('search', { q: 'café ☕' }));
    guard.check(tool('search', { q: 'café ☕' }));

    expect(guard.check(tool('search', { q: 'café ☕' })).allowed).toBe(false);
  });
});

describe('edge case: hostile inputs', () => {
  it('handles undefined arguments', () => {
    const guard = new Guardrail([
      new LoopChecker({ maxRepeatedCalls: 2, detectCycles: false }),
    ]);
    guard.start();

    expect(() =>
      guard.check({ type: 'tool_call', tool: 't', timestamp: Date.now() })
    ).not.toThrow();
  });

  it('handles a step with no content', () => {
    const guard = new Guardrail([]);
    guard.start();
    expect(guard.check({ type: 'llm_response', timestamp: 0 }).allowed).toBe(true);
  });

  it('handles a very long content string', () => {
    const guard = new Guardrail([]);
    guard.start();
    const huge = 'x'.repeat(500_000);
    expect(() => guard.check({ type: 'llm_response', content: huge, timestamp: 0 })).not.toThrow();
  });

  it('handles a prototype-polluting argument object', () => {
    const guard = new Guardrail([
      new LoopChecker({ maxRepeatedCalls: 2, detectCycles: false }),
    ]);
    guard.start();

    const polluted = JSON.parse('{"__proto__": {"polluted": true}, "x": 1}') as Record<
      string,
      unknown
    >;
    expect(() => guard.check(tool('t', polluted))).not.toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
