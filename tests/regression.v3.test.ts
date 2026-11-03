/**
 * Regression tests for bugs found in v3.0.x.
 *
 * Each test here corresponds to a defect that shipped in a published release.
 * They are written to fail against v3 and pass against v4.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Guardrail } from '../src/core/Guardrail.js';
import { AgentLoopGuard } from '../src/core/AgentLoopGuard.js';
import { LoopChecker } from '../src/checkers/LoopChecker.js';
import { tool, llm } from './_helpers.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('regression: v3 packaging bugs', () => {
  it('package.json does not depend on itself', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(root, 'package.json'), 'utf8')
    ) as {
      name: string;
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    // v3 shipped `"dependencies": { "agent-loop-guard-js": "^3.0.0" }` — the
    // package depending on itself.
    expect(pkg.dependencies?.['agent-loop-guard-js']).toBeUndefined();
    expect(pkg.peerDependencies?.['agent-loop-guard-js']).toBeUndefined();
    expect(pkg.devDependencies?.['agent-loop-guard-js']).toBeUndefined();
  });

  it('has zero runtime dependencies', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(root, 'package.json'), 'utf8')
    ) as { dependencies?: Record<string, string> };

    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(0);
  });

  it('publishes only the current build output (no stale v2 artifacts)', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(root, 'package.json'), 'utf8')
    ) as { files: string[] };

    expect(pkg.files).toContain('dist');
    // `files` must not include the whole repository root.
    expect(pkg.files).not.toContain('.');
    expect(pkg.files).not.toContain('src');
  });
});

describe('regression: v3 canonicalize was never used by LoopChecker', () => {
  it('detects a repeated call whose arguments differ only in key order', () => {
    // v3 compared `JSON.stringify(h.args) === JSON.stringify(step.args)`, so
    // `{a:1,b:2}` and `{b:2,a:1}` were considered different calls and the
    // loop was never detected.
    const guard = new Guardrail([
      new LoopChecker({ maxRepeatedCalls: 2, detectCycles: false }),
    ]);
    guard.start();

    expect(guard.check(tool('search', { a: 1, b: 2 })).allowed).toBe(true);
    expect(guard.check(tool('search', { b: 2, a: 1 })).allowed).toBe(true);

    const decision = guard.check(tool('search', { a: 1, b: 2 }));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('LOOP_PATTERN_DETECTED');
  });

  it('detects a repeated call with equivalent nested arguments', () => {
    const guard = new Guardrail([
      new LoopChecker({ maxRepeatedCalls: 2, detectCycles: false }),
    ]);
    guard.start();

    guard.check(tool('api', { q: { x: 1, y: 2 } }));
    guard.check(tool('api', { q: { y: 2, x: 1 } }));

    expect(guard.check(tool('api', { q: { x: 1, y: 2 } })).allowed).toBe(false);
  });
});

describe('regression: v3 AgentLoopGuard shim never detected anything', () => {
  it('enforces maxSteps', () => {
    // v3's `AgentLoopGuard.check()` passed `[]` as the history, so the step
    // budget could never be reached.
    const guard = new AgentLoopGuard({ loop: { maxSteps: 3 } });
    guard.start();

    expect(guard.check(llm('ok')).allowed).toBe(true);
    expect(guard.check(llm('ok')).allowed).toBe(true);
    expect(guard.check(llm('ok')).allowed).toBe(true);

    const decision = guard.check(llm('ok'));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('MAX_STEPS_EXCEEDED');
  });

  it('enforces maxRepeatedCalls', () => {
    const guard = new AgentLoopGuard({
      loop: { maxRepeatedCalls: 2, detectCycles: false },
    });
    guard.start();

    expect(guard.check(tool('search', { q: 'x' })).allowed).toBe(true);
    expect(guard.check(tool('search', { q: 'x' })).allowed).toBe(true);
    expect(guard.check(tool('search', { q: 'x' })).allowed).toBe(false);
  });

  it('retains history so state is actually tracked', () => {
    const guard = new AgentLoopGuard({ loop: { maxSteps: 10 } });
    guard.start();

    guard.check(llm('one'));
    guard.check(llm('two'));

    expect(guard.getHistorySize()).toBe(2);
    expect(guard.getHistory()[0]?.content).toBe('one');
  });
});

describe('regression: v3 maxDuration was dead code', () => {
  it('enforces the duration budget', () => {
    // v3's Guardrail never passed `startTime` to LoopChecker, so the duration
    // check could never fire.
    let now = 1_000;
    const guard = new Guardrail([new LoopChecker({ maxDuration: 100 })], {
      clock: () => now,
    });
    guard.start();

    expect(guard.check(llm('first')).allowed).toBe(true);

    now += 500;
    const decision = guard.check(llm('second'));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('MAX_DURATION_EXCEEDED');
  });

  it('does not fire the duration check before the budget is exceeded', () => {
    let now = 1_000;
    const guard = new Guardrail([new LoopChecker({ maxDuration: 100 })], {
      clock: () => now,
    });
    guard.start();

    expect(guard.check(llm('first')).allowed).toBe(true);
    now += 50;
    expect(guard.check(llm('second')).allowed).toBe(true);
  });
});

describe('regression: v3 history grew without bound', () => {
  it('bounds the retained history', () => {
    const guard = new Guardrail([new LoopChecker({ maxSteps: 1000 })], {
      historyLimit: 10,
    });
    guard.start();

    for (let i = 0; i < 100; i += 1) {
      guard.check(llm(`step ${i}`));
    }

    expect(guard.getHistorySize()).toBe(10);
    expect(guard.snapshot().historySize).toBe(10);
  });

  it('keeps the most recent steps, dropping the oldest', () => {
    const guard = new Guardrail([], { historyLimit: 3 });
    guard.start();

    for (let i = 0; i < 5; i += 1) {
      guard.check(llm(`step ${i}`));
    }

    const history = guard.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0]?.content).toBe('step 2');
    expect(history[2]?.content).toBe('step 4');
  });
});

describe('regression: v3 GuardReason could not express custom reasons', () => {
  it('accepts a custom reason from a user-supplied checker', () => {
    // The v3 `GuardReason` union was closed, so the README's own
    // `CostChecker` example did not typecheck.
    const guard = new Guardrail([
      {
        name: 'CostChecker',
        check: () => ({
          allowed: false,
          reason: 'BUDGET_EXCEEDED' as const,
          message: 'Too expensive',
        }),
      },
    ]);
    guard.start();

    const decision = guard.check(llm('x'));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('BUDGET_EXCEEDED');
  });
});

describe('regression: v3 violation handler could not be typed safely', () => {
  it('reports the checker name and full decision on the event', () => {
    const events: string[] = [];
    const guard = new Guardrail([new LoopChecker({ maxSteps: 1 })], {
      onViolation: (event) => {
        events.push(`${event.checker}:${event.reason}`);
        expect(event.decision).toBeDefined();
        expect(event.step).toBeDefined();
      },
    });
    guard.start();

    guard.check(llm('one'));
    guard.check(llm('two'));

    expect(events).toEqual(['LoopChecker:MAX_STEPS_EXCEEDED']);
  });
});
