import { describe, it, expect } from 'vitest';
import { LoopChecker } from '../src/checkers/LoopChecker.js';
import { detectCycle, sameSignature } from '../src/normalization/cycle.js';
import { tool, llm } from './_helpers.js';

describe('LoopChecker - step budget', () => {
  it('allows steps up to the limit and blocks the one that exceeds it', () => {
    const checker = new LoopChecker({ maxSteps: 3 });
    const history = [llm('1'), llm('2')];

    expect(checker.check(llm('3'), history).allowed).toBe(true);
    expect(checker.check(llm('4'), [llm('1'), llm('2'), llm('3')]).allowed).toBe(false);
  });

  it('treats maxSteps: 0 as "block immediately"', () => {
    const checker = new LoopChecker({ maxSteps: 0 });
    const decision = checker.check(llm('x'), []);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('MAX_STEPS_EXCEEDED');
  });

  it('rejects a negative maxSteps', () => {
    expect(() => new LoopChecker({ maxSteps: -1 })).toThrow(RangeError);
  });

  it('rejects a negative maxDuration', () => {
    expect(() => new LoopChecker({ maxDuration: -1 })).toThrow(RangeError);
  });

  it('rejects a maxRepeatedCalls below 1', () => {
    expect(() => new LoopChecker({ maxRepeatedCalls: 0 })).toThrow(RangeError);
  });
});

describe('LoopChecker - repeated calls', () => {
  it('counts identical calls', () => {
    const checker = new LoopChecker({ maxRepeatedCalls: 3, detectCycles: false });
    const history = [tool('a', { x: 1 }), tool('a', { x: 1 })];

    expect(checker.check(tool('a', { x: 1 }), history).allowed).toBe(true);
    expect(checker.check(tool('a', { x: 1 }), [...history, tool('a', { x: 1 })]).allowed).toBe(false);
  });

  it('ignores different tools with the same args', () => {
    const checker = new LoopChecker({ maxRepeatedCalls: 2, detectCycles: false });
    const history = [tool('a', { x: 1 }), tool('a', { x: 1 })];
    expect(checker.check(tool('b', { x: 1 }), history).allowed).toBe(true);
  });

  it('ignores different args for the same tool', () => {
    const checker = new LoopChecker({ maxRepeatedCalls: 2, detectCycles: false });
    const history = [tool('a', { x: 1 }), tool('a', { x: 1 })];
    expect(checker.check(tool('a', { x: 2 }), history).allowed).toBe(true);
  });

  it('does not count non-tool steps', () => {
    const checker = new LoopChecker({ maxRepeatedCalls: 2, detectCycles: false });
    const history = [llm('same'), llm('same'), llm('same')];
    expect(checker.check(llm('same'), history).allowed).toBe(true);
  });

  it('only counts repeats inside the window', () => {
    const checker = new LoopChecker({
      maxRepeatedCalls: 3,
      detectCycles: false,
      windowSize: 2,
    });
    // Five identical calls in history, but the window only keeps the last two,
    // so the count (2) stays below the limit (3).
    const history = [
      tool('a', { x: 1 }),
      tool('a', { x: 1 }),
      tool('a', { x: 1 }),
      tool('a', { x: 1 }),
      tool('a', { x: 1 }),
    ];
    expect(checker.check(tool('a', { x: 1 }), history).allowed).toBe(true);
  });

  it('blocks once the window contains enough repeats', () => {
    const checker = new LoopChecker({
      maxRepeatedCalls: 3,
      detectCycles: false,
      windowSize: 3,
    });
    const history = [tool('a', { x: 1 }), tool('a', { x: 1 }), tool('a', { x: 1 })];
    expect(checker.check(tool('a', { x: 1 }), history).allowed).toBe(false);
  });
});

describe('LoopChecker - cycle detection', () => {
  it('detects an alternating A -> B cycle', () => {
    const checker = new LoopChecker({ maxRepeatedCalls: 100, detectCycles: true });
    const history = [tool('a'), tool('b'), tool('a'), tool('b')];

    const decision = checker.check(tool('a'), history);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('CYCLE_DETECTED');
    expect(decision.metadata?.cycleLength).toBe(2);
  });

  it('detects a 3-step cycle', () => {
    const checker = new LoopChecker({ maxRepeatedCalls: 100, detectCycles: true });
    const history = [tool('a'), tool('b'), tool('c'), tool('a'), tool('b'), tool('c')];

    const decision = checker.check(tool('a'), history);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('CYCLE_DETECTED');
  });

  it('does not fire on a non-repeating sequence', () => {
    const checker = new LoopChecker({ maxRepeatedCalls: 100, detectCycles: true });
    const history = [tool('a'), tool('b'), tool('c'), tool('d')];

    expect(checker.check(tool('e'), history).allowed).toBe(true);
  });

  it('can be disabled', () => {
    const checker = new LoopChecker({ maxRepeatedCalls: 100, detectCycles: false });
    const history = [tool('a'), tool('b'), tool('a'), tool('b')];

    expect(checker.check(tool('a'), history).allowed).toBe(true);
  });
});

describe('detectCycle', () => {
  const sig = (tool: string) => ({ type: 'tool_call', tool, args: '' });

  it('returns null for a short history', () => {
    expect(detectCycle([sig('a')])).toBeNull();
  });

  it('returns null for a non-repeating sequence', () => {
    expect(detectCycle([sig('a'), sig('b'), sig('c')])).toBeNull();
  });

  it('finds a 2-cycle', () => {
    const cycle = detectCycle([sig('a'), sig('b'), sig('a'), sig('b')]);
    expect(cycle).not.toBeNull();
    expect(cycle).toHaveLength(2);
  });

  it('finds a 3-cycle', () => {
    const cycle = detectCycle([
      sig('a'), sig('b'), sig('c'), sig('a'), sig('b'), sig('c'),
    ]);
    expect(cycle).not.toBeNull();
    expect(cycle).toHaveLength(3);
  });

  it('respects the maximum cycle length', () => {
    const cycle = detectCycle(
      [sig('a'), sig('b'), sig('c'), sig('a'), sig('b'), sig('c')],
      2
    );
    expect(cycle).toBeNull();
  });
});

describe('sameSignature', () => {
  it('compares type, tool and args', () => {
    const a = { type: 'tool_call', tool: 'x', args: 'k' };
    expect(sameSignature(a, { ...a })).toBe(true);
    expect(sameSignature(a, { ...a, tool: 'y' })).toBe(false);
    expect(sameSignature(a, { ...a, args: 'other' })).toBe(false);
  });
});
