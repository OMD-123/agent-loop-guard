
import { Guardrail, LoopChecker } from '../src/index.js';

const guard = new Guardrail([
  new LoopChecker({ maxSteps: 10 })
]);

guard.start();

const steps = [
  { type: 'llm_response', content: 'Hello', timestamp: Date.now() },
  { type: 'tool_call', tool: 'search', args: { q: 'weather' }, timestamp: Date.now() },
];

steps.forEach(step => {
  const decision = guard.check(step as any);
  console.log(`Step allowed: ${decision.allowed}`);
});
