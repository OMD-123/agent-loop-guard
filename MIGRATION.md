# Migration Guide: v2.x to v3.x

`agent-loop-guard` has evolved from a loop detector into a full guardrail framework.

## What Changed?

In v2, you used `AgentLoopGuard` directly. In v3, we introduce the `Guardrail` class which allows you to compose multiple safety checks (Loop, Security, Content, etc.).

### v2 (Old Way)
```ts
import { AgentLoopGuard } from 'agent-loop-guard-js';

const guard = new AgentLoopGuard({ maxSteps: 10 });
const decision = guard.check(step);
```

### v3 (New Way)
```ts
import { Guardrail, LoopChecker, SecurityChecker } from 'agent-loop-guard-js';

const guard = new Guardrail([
  new LoopChecker({ maxSteps: 10 }),
  new SecurityChecker({ detectInjection: true })
]);

const decision = guard.check(step);
```

## Breaking Changes
- `AgentLoopGuard` is now `LoopChecker`.
- The main entry point for orchestrating multiple checks is now the `Guardrail` class.
