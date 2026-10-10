
import { Guardrail, LoopChecker } from '../src/index.js';

const guard = new Guardrail([
  new LoopChecker({ maxRepeatedCalls: 2 })
]);

const step = { type: 'tool_call', tool: 'calc', args: { op: 'add' }, timestamp: Date.now() };
guard.check(step as any);
guard.check(step as any);
console.log('Third call should be blocked:', guard.check(step as any).allowed);
