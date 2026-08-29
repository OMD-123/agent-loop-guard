import { describe, it, expect } from "vitest";
import { AgentLoopGuard } from "../src/index.js";

describe("configuration validation", () => {
  it("accepts empty options (all limits disabled)", () => {
    expect(() => new AgentLoopGuard()).not.toThrow();
  });

  it("rejects negative maxSteps", () => {
    expect(() => new AgentLoopGuard({ maxSteps: -1 })).toThrow(/maxSteps/);
  });

  it("rejects negative maxDuration", () => {
    expect(() => new AgentLoopGuard({ maxDuration: -5 })).toThrow(/maxDuration/);
  });

  it("rejects fractional maxSteps", () => {
    expect(() => new AgentLoopGuard({ maxSteps: 2.5 })).toThrow(/maxSteps/);
  });

  it("rejects a zero maxRepeatedCalls when enabled? -> 0 disables (no throw)", () => {
    expect(() => new AgentLoopGuard({ maxRepeatedCalls: 0 })).not.toThrow();
  });

  it("rejects invalid loopPatternWindow (< 2 when enabled)", () => {
    expect(() => new AgentLoopGuard({ loopPatternWindow: 1 })).toThrow(/loopPatternWindow/);
  });

  it("rejects loopPatternWindow that is not an integer", () => {
    expect(() => new AgentLoopGuard({ loopPatternWindow: 2.5 })).toThrow(/loopPatternWindow/);
  });

  it("rejects a non-function onViolation", () => {
    expect(() => new AgentLoopGuard({ onViolation: "nope" as unknown as () => void })).toThrow(/onViolation/);
  });

  it("rejects non-object options", () => {
    expect(() => new AgentLoopGuard(5 as unknown as object)).toThrow(/options/);
  });

  it("applies sensible defaults (unlimited)", () => {
    const guard = new AgentLoopGuard();
    for (let i = 0; i < 100; i++) {
      expect(guard.check({ type: "tool", name: `t${i}` }).allowed).toBe(true);
    }
  });
});
