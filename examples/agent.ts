/**
 * Guarding a tool-calling agent end to end.
 *
 * This is the canonical integration: every tool call goes through
 * `guard.guard()`, which evaluates the step and only runs the executor when
 * the step is allowed.
 *
 * Run with: `npx tsx examples/agent.ts`
 */
import {
  Guardrail,
  LoopChecker,
  SecurityChecker,
  ToolPolicyChecker,
  TokenBudgetChecker,
  type AgentStep,
} from '../src/index.js';

const guard = new Guardrail(
  [
    new ToolPolicyChecker({
      allowedTools: ['search', 'read_file'],
      deniedTools: ['delete_everything'],
    }),
    new LoopChecker({ maxSteps: 25, maxRepeatedCalls: 3 }),
    new SecurityChecker({ detectInjection: true }),
    new TokenBudgetChecker({ maxTokens: 10_000, warnThreshold: 0.8 }),
  ],
  {
    mode: 'enforce',
    historyLimit: 100,
    onViolation: (event) => {
      console.log(`  [violation] ${event.reason} (${event.checker})`);
    },
  }
);

guard.start();

/** A pretend tool implementation. */
async function runTool(step: AgentStep): Promise<string> {
  const name = step.tool ?? 'unknown';
  await new Promise((resolve) => setTimeout(resolve, 5));
  return `result of ${name}`;
}

const proposed: AgentStep[] = [
  { type: 'tool_call', tool: 'search', args: { q: 'guardrails' }, timestamp: Date.now() },
  { type: 'tool_call', tool: 'read_file', args: { path: '/tmp/x' }, timestamp: Date.now() },
  { type: 'tool_call', tool: 'delete_everything', args: {}, timestamp: Date.now() },
  { type: 'tool_call', tool: 'shell', args: { cmd: 'ls' }, timestamp: Date.now() },
  {
    type: 'tool_call',
    tool: 'search',
    args: { q: 'guardrails' },
    timestamp: Date.now(),
    tokens: 120,
  },
];

for (const step of proposed) {
  const result = await guard.guard(step, () => runTool(step));

  if (!result.allowed) {
    console.log(`BLOCKED  ${step.tool}: ${result.decision.reason}`);
    continue;
  }
  console.log(`OK       ${step.tool}: ${result.value}`);
}

console.log('\nfinal stats:', guard.getStats());
