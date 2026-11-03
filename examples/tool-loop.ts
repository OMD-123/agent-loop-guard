/**
 * Detecting a runaway loop.
 *
 * The agent keeps calling the same tool. The guard notices the repetition and
 * blocks the call before it burns the budget.
 *
 * Run with: `npx tsx examples/tool-loop.ts`
 */
import {
  Guardrail,
  LoopChecker,
  type AgentStep,
} from '../src/index.js';

const guard = new Guardrail([
  new LoopChecker({
    maxSteps: 50,
    maxRepeatedCalls: 3,
    detectCycles: true,
    maxCycleLength: 5,
  }),
]);

guard.start();

console.log('--- identical calls ---');
for (let i = 0; i < 6; i += 1) {
  const step: AgentStep = {
    type: 'tool_call',
    tool: 'search',
    args: { query: 'node.js streams' },
    timestamp: Date.now(),
  };
  const decision = guard.check(step);
  console.log(
    decision.allowed
      ? `call ${i + 1}: allowed`
      : `call ${i + 1}: BLOCKED — ${decision.reason}`
  );
}

console.log('\n--- alternating cycle (A -> B -> A -> B ...) ---');
guard.start();

const cycle = ['fetch_user', 'fetch_user'].flatMap((tool, i) =>
  Array.from({ length: 3 }, () => ({
    type: 'tool_call' as const,
    tool: i === 0 ? 'list_users' : tool,
    args: {},
    timestamp: Date.now(),
  }))
);

for (const step of cycle) {
  const decision = guard.check(step);
  if (!decision.allowed) {
    console.log(`BLOCKED — ${decision.reason}: ${decision.message}`);
  }
}
