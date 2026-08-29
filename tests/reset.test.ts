import { describe, it, expect } from "vitest";
import { AgentLoopGuard } from "../src/index.js";
import type { AgentStep } from "../src/types/index.js";

const tool = (name: string): AgentStep => ({ type: "tool", name });

describe("AgentLoopGuard.reset", () => {
  it("clears step count and history", () => {
    const guard = new AgentLoopGuard({ maxSteps: 2 });
    guard.check(tool("a"));
    guard.check(tool("b"));
    expect(guard.stepCount).toBe(2);
    guard.reset();
    expect(guard.stepCount).toBe(0);
  });

  it("allows a previously-blocked run to start fresh", () => {
    const guard = new AgentLoopGuard({ maxSteps: 2 });
    expect(guard.check(tool("a")).allowed).toBe(true);
    expect(guard.check(tool("b")).allowed).toBe(true);
    expect(guard.check(tool("c")).allowed).toBe(false); // blocked at 3
    guard.reset();
    expect(guard.check(tool("a")).allowed).toBe(true); // fresh run
    expect(guard.check(tool("b")).allowed).toBe(true);
  });

  it("clears repeated-call state", () => {
    const guard = new AgentLoopGuard({ maxRepeatedCalls: 2 });
    guard.check(tool("x"));
    guard.check(tool("x"));
    expect(guard.check(tool("x")).allowed).toBe(false);
    guard.reset();
    expect(guard.check(tool("x")).allowed).toBe(true);
    expect(guard.check(tool("x")).allowed).toBe(true);
  });

  it("clears same-tool state", () => {
    const guard = new AgentLoopGuard({ maxSameToolCalls: 2 });
    guard.check(tool("t"));
    guard.check(tool("t"));
    expect(guard.check(tool("t")).allowed).toBe(false);
    guard.reset();
    expect(guard.check(tool("t")).allowed).toBe(true);
    expect(guard.check(tool("t")).allowed).toBe(true);
  });

  it("resets stats", () => {
    const guard = new AgentLoopGuard({ maxSteps: 100 });
    guard.check(tool("a"));
    guard.check(tool("b"));
    guard.check({ type: "llm", name: "gpt" });
    expect(guard.stats().stepCount).toBe(3);
    guard.reset();
    const s = guard.stats();
    expect(s.stepCount).toBe(0);
    expect(s.toolCalls).toBe(0);
    expect(s.llmCalls).toBe(0);
    expect(s.uniqueTools).toBe(0);
    expect(s.duration).toBe(0);
  });

  it("resets the run timer", () => {
    const guard = new AgentLoopGuard({ maxDuration: 10 });
    guard.start();
    // After reset, no start time -> duration checks skipped until re-start.
    guard.reset();
    expect(guard.check({ type: "tool", name: "x", timestamp: 999_999 }).allowed).toBe(true);
  });
});
