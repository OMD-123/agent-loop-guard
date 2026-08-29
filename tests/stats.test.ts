import { describe, it, expect } from "vitest";
import { AgentLoopGuard } from "../src/index.js";
import type { AgentStep } from "../src/types/index.js";

const step = (name: string): AgentStep => ({ type: "tool", name });

describe("stats()", () => {
  it("reports counts for a mixed run", () => {
    const guard = new AgentLoopGuard({ maxSteps: 100, maxSameToolCalls: 100 });
    guard.check({ type: "llm", name: "gpt" });
    guard.check(step("search"));
    guard.check(step("search"));
    guard.check(step("fetch"));
    const s = guard.stats();
    expect(s.stepCount).toBe(4);
    expect(s.toolCalls).toBe(3);
    expect(s.llmCalls).toBe(1);
    expect(s.uniqueTools).toBe(2);
  });

  it("counts repeatedCalls as steps beyond the distinct set", () => {
    const guard = new AgentLoopGuard({ maxSteps: 100 });
    guard.check(step("a"));
    guard.check(step("a")); // repeat
    guard.check(step("a")); // repeat
    guard.check(step("b"));
    const s = guard.stats();
    // 4 steps, 3 distinct (a, a, a, b) -> 4 - 2 distinct = 2 repeats
    expect(s.repeatedCalls).toBe(2);
  });

  it("is read-only: returning a fresh object each call", () => {
    const guard = new AgentLoopGuard();
    guard.check(step("a"));
    const s1 = guard.stats();
    guard.check(step("b"));
    const s2 = guard.stats();
    expect(s1.stepCount).toBe(1);
    expect(s2.stepCount).toBe(2);
  });
});
