
import { Guardrail, LoopChecker, SecurityChecker } from '../src/index.js';

const guard = new Guardrail([
  new LoopChecker({ maxSteps: 10 }),
  new SecurityChecker({ detectInjection: true, blockUnsafeWords: [] })
]);

guard.start();

async function runStep(step: any) {
  const decision = guard.check(step);
  if (!decision.allowed) {
    console.error(`Blocked: ${decision.reason}`);
    return;
  }
  console.log("Step approved, executing...");
}

runStep({ type: 'tool_call', tool: 'search', args: { q: 'test' }, timestamp: Date.now() });
