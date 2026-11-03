# Migration Guide: v3.x → v4.x

`agent-loop-guard-js` v4 is a correctness and packaging release. The public
API is largely compatible — most projects only need to run
`npm install agent-loop-guard-js@4` and re-run their tests.

---

## What was broken in v3

v3 shipped several defects that made the library do less than it advertised.
If you relied on any of the behaviour below, **your v4 behaviour will
differ** — usually in the direction of the guard actually working.

### 1. The package depended on itself

```json
"dependencies": { "agent-loop-guard-js": "^3.0.0" }
```

`npm install` pulled the published package into its own dependency tree.
v4 has **zero runtime dependencies**.

### 2. Loop detection missed reordered arguments

`LoopChecker` compared tool arguments with `JSON.stringify()`:

```ts
JSON.stringify(h.args) === JSON.stringify(step.args)
```

`{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` stringify differently, so the
repetition check never fired for them. v4 compares canonical keys, so those
two calls are correctly identified as identical.

### 3. `AgentLoopGuard` never enforced anything

v3's `AgentLoopGuard` was a shim:

```ts
check(step: AgentStep): GuardDecision {
  return this.checker.check(step, []); // <-- empty history, always
}
```

With an empty history, `maxSteps` and `maxRepeatedCalls` could never be
reached. v4's `AgentLoopGuard` maintains real history.

### 4. `maxDuration` was never evaluated

`Guardrail` never passed the session start time to `LoopChecker`, so the
duration budget was dead code. v4 passes it through `CheckerContext`.

### 5. History grew without bound

`Guardrail` retained every step for the lifetime of the process. v4 uses a
bounded ring buffer (`historyLimit`, default `200`).

### 6. `GuardReason` was a closed union

```ts
export type GuardReason = 'LOOP_PATTERN_DETECTED' | ...; // no custom values
```

Custom checkers had to cast to `any` — including the example in v3's own
README. v4 uses:

```ts
export type GuardReason = BuiltinGuardReason | (string & NonNullable<unknown>);
```

### 7. Stale artifacts were published

v3's `dist/` contained orphaned v2 files (`dist/detectors/*`,
`dist/core/GuardState`, `dist/core/options`) that no longer had any source.
v4 cleans `dist/` before every build.

---

## Upgrade

```bash
npm install agent-loop-guard-js@^4.0.0
```

No code changes are required for most projects. Read on if you use the
areas below.

---

## API changes

### `AgentStep.content` is `unknown`

```ts
// v3
content: any;

// v4
content?: StepContent;   // where StepContent = unknown
```

Agent frameworks emit arbitrary provider-shaped payloads (`{ text }`,
`{ content: [...] }`, `{ message: { content } }`), so `unknown` is the honest
type. Use the exported `extractText()` helper to flatten a payload into
searchable text:

```ts
import { extractText } from 'agent-loop-guard-js';

const text = extractText(step.content);
```

If you need a specific shape, narrow it yourself:

```ts
const step: AgentStep = {
  type: 'llm_response',
  content: myProviderPayload,   // assignable to unknown
  timestamp: Date.now(),
};
```

### `timestamp` is now required

v3's `AgentStep` declared `timestamp: number` but every example used `as any`
to bypass it. v4 keeps it required and the built-in helpers provide it.

### `GuardDecision` has new fields

```ts
interface GuardDecision {
  allowed: boolean;
  reason?: GuardReason;
  message?: string;
  checker?: string;    // new
  severity?: GuardSeverity;  // new
  metadata?: Record<string, unknown>;  // new
}
```

Existing code that only reads `allowed` and `reason` is unaffected.

### `ViolationEvent` has new fields

```ts
interface ViolationEvent {
  reason: GuardReason;
  step: AgentStep;
  timestamp: number;
  decision: GuardDecision;  // new
  checker?: string;         // new
}
```

### Checkers receive a context argument

The `Checker` interface gained an optional third parameter:

```ts
interface Checker {
  name: string;
  check(step: AgentStep, history: AgentStep[], context?: CheckerContext): GuardDecision;
  checkAsync?(step: AgentStep, history: AgentStep[], context: CheckerContext): Promise<GuardDecision>;
  reset?(): void;
}
```

Existing implementations still typecheck — the parameter is optional.

### `SecurityChecker` options are now optional

v3 required `{ detectInjection, blockUnsafeWords }`. v4 makes both optional
and adds:

```ts
new SecurityChecker({
  detectInjection: true,          // default true
  blockUnsafeWords: [],           // default []
  customInjectionPatterns: [],    // new
  ignoreDefaultPatterns: false,   // new
  inspectTypes: [...],            // new
});
```

### `HallucinationChecker` strictness semantics changed

- `medium` (the default) now requires **either** two matching keywords
  **or** one strong signal (`not found`, `does not exist`, `no such`).
- `high` blocks on any single match, as before.

If you relied on `medium` blocking a single weak keyword, use `high`.

---

## New capabilities

### Tool policies

```ts
import { ToolPolicyChecker } from 'agent-loop-guard-js';

new ToolPolicyChecker({
  allowedTools: ['search', 'read_file'],
  deniedTools: ['delete_everything'],
  maxCallsPerTool: 10,
});
```

### Token budgets

```ts
import { TokenBudgetChecker } from 'agent-loop-guard-js';

new TokenBudgetChecker({ maxTokens: 100_000, warnThreshold: 0.8 });
```

Set `step.tokens` on each step to feed the budget.

### Monitor mode

```ts
const guard = new Guardrail(checkers, { mode: 'monitor' });
```

In monitor mode a violating step is **allowed** but still reports its
`reason`, and the violation callback still fires. Use it to roll out new
rules without breaking production.

### Circuit breaker

```ts
const guard = new Guardrail(checkers, {
  circuitBreaker: true,
  failureThreshold: 5,
  resetTimeout: 30_000,
});
```

### Async checkers

```ts
const decision = await guard.checkAsync(step);
const result = await guard.guard(step, () => callTool());
```

### Statistics

```ts
guard.getStats();
guard.snapshot();
```

---

## Import paths

If you imported deep paths, they moved:

| v3 | v4 |
| :--- | :--- |
| `agent-loop-guard-js` | `agent-loop-guard-js` (unchanged) |
| `src/types/index.ts` | `src/types.ts` |
| `src/errors/AgentLoopGuardError.ts` | `src/errors.ts` |

Deep imports are not part of the public API and are not exported via the
package `exports` map. Import from the package root.

---

## Checklist

- [ ] `npm install agent-loop-guard-js@^4.0.0`
- [ ] Re-run your test suite — loop detection is now stricter, so a test that
      relied on reordered arguments *not* matching may now fail.
- [ ] Review any custom `GuardReason` casts; they can be removed.
- [ ] If you used `maxDuration`, confirm it now fires (it was previously
      inert).
- [ ] If you set `historyLimit`, pick a value that covers your longest
      expected detection window.
