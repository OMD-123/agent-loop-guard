import { AgentLoopGuard, AgentLoopGuardError } from "../src/index.js";
import type { AgentStep } from "../src/types/index.js";

// Generic agent stub: yields steps. The guard is framework-independent, so it
// drops in around ANY agent's step stream without touching the agent's internals.
async function* fakeAgent(): AsyncGenerator<AgentStep> {
  const plan: AgentStep[] = [
    { type: "llm", name: "gpt-4" },
    { type: "tool", name: "web_search", arguments: { query: "TypeScript" } },
    { type: "llm", name: "gpt-4" },
    { type: "tool", name: "web_search", arguments: { query: "Rust" } },
    { type: "llm", name: "gpt-4" },
  ];
  for (const step of plan) {
    await new Promise((r) => setTimeout(r, 1));
    yield step;
  }
}

async function run() {
  const guard = new AgentLoopGuard({
    maxSteps: 20,
    maxRepeatedCalls: 3,
    maxSameToolCalls: 5,
    loopPatternWindow: 6,
  });

  guard.start();

  for await (const step of fakeAgent()) {
    const decision = guard.check(step);

    if (!decision.allowed) {
      console.error("Agent stopped:", decision.reason);
      break;
    }

    // The guard only OBSERVES. Your application executes the approved step:
    console.log("execute:", step.type, step.name);
  }

  // Optional: throw a structured error instead of branching.
  try {
    const d = guard.check({ type: "tool", name: "x" });
    if (!d.allowed) throw new AgentLoopGuardError(d);
  } catch (err) {
    if (err instanceof AgentLoopGuardError) {
      console.error("Structured error:", err.reason, err.stepCount);
    }
  }

  guard.end();
  console.log("final stats:", guard.stats());
}

run();
