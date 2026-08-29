import { AgentLoopGuard } from "../src/index.js";
import type { AgentStep } from "../src/types/index.js";

// Demonstrates catching a tool that keeps getting called with the same args.
const guard = new AgentLoopGuard({
  maxRepeatedCalls: 3,
  maxSameToolCalls: 5,
  onViolation: (e) => console.warn("Violation:", e.reason, "at step", e.stepCount),
});

const query = "best pizza near me";
let produced = 0;

// Simulate an agent that mistakenly re-issues the same tool call.
while (produced < 8) {
  const step: AgentStep = {
    type: "tool",
    name: "search",
    arguments: { query },
  };
  const decision = guard.check(step);
  if (!decision.allowed) {
    console.error(`Loop detected (${decision.reason}). Stopping.`);
    break;
  }
  produced++;
}

console.log("executed steps:", produced);
