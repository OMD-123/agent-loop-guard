import { AgentLoopGuard } from "../src/index.js";
import type { AgentStep } from "../src/types/index.js";

// Smallest useful integration: guard a list of pre-defined steps.
const guard = new AgentLoopGuard({
  maxSteps: 20,
  maxDuration: 60_000,
  maxRepeatedCalls: 3,
  maxSameToolCalls: 5,
  loopPatternWindow: 6,
});

const steps: AgentStep[] = [
  { type: "llm", name: "gpt-4" },
  { type: "tool", name: "web_search", arguments: { query: "Node.js clustering" } },
  { type: "llm", name: "gpt-4" },
  { type: "tool", name: "web_search", arguments: { query: "Node.js clustering" } },
];

for (const step of steps) {
  const decision = guard.check(step);
  if (!decision.allowed) {
    console.error(`Stopped: ${decision.reason}`);
    break;
  }
  // Application executes the approved step here.
}

console.log("stats:", guard.stats());
