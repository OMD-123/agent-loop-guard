
import { Guardrail, LoopChecker, SecurityChecker } from '../src/index.js';

const guard = new Guardrail([
  new LoopChecker({ maxSteps: 10 }),
  new SecurityChecker({ detectInjection: true, blockUnsafeWords: [] })
]);

guard.start();
const step = { type: 'llm_response', content: 'Hello', timestamp: Date.now() };
guard.check(step as any);
