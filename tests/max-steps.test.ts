import { describe, it, expect } from "vitest";
import { AgentLoopGuard } from "../src/index.js";
import { isBlocked } from "./_helpers.js";
import type { AgentStep } from "../src/types/index.js";

const tool = (name: string): AgentStep => ({ type: "tool", name });

describe("MaxStepsDetector", () => {
  it("allows while below the limit", () => {
    const guard = new AgentLoopGuard({ maxSteps: 5 });
    for (let i = 0; i < 4; i++) {
      expect(guard.check(tool(`t${i}`)).allowed).toBe(true);
    }
  });

  it("allows exactly at the limit (limit is the last allowed step)", () => {
    const guard = new AgentLoopGuard({ maxSteps: 3 });
    expect(guard.check(tool("a")).allowed).toBe(true); // 1
    expect(guard.check(tool("b")).allowed).toBe(true); // 2
    expect(guard.check(tool("c")).allowed).toBe(true); // 3 == limit
  });

  it("blocks one step above the limit", () => {
    const guard = new AgentLoopGuard({ maxSteps: 3 });
    guard.check(tool("a")); // 1
    guard.check(tool("b")); // 2
    guard.check(tool("c")); // 3
    const d = guard.check(tool("d")); // 4 -> blocked
    expect(d.allowed).toBe(false);
    if (isBlocked(d)) {
      expect(d.reason).toBe("MAX_STEPS_EXCEEDED");
      expect(d.stepCount).toBe(4);
    }
  });

  it("reports the exceeded count in details", () => {
    const guard = new AgentLoopGuard({ maxSteps: 2 });
    guard.check(tool("a"));
    guard.check(tool("b"));
    const third = guard.check(tool("c"));
    expect(third.allowed).toBe(false);
    if (isBlocked(third)) {
      expect(third.details?.maxSteps).toBe(2);
      expect(third.stepCount).toBe(3);
    }
  });

  it("is disabled when maxSteps is 0 (default)", () => {
    const guard = new AgentLoopGuard();
    for (let i = 0; i < 50; i++) {
      expect(guard.check(tool(`t${i}`)).allowed).toBe(true);
    }
  });

  it("fires onViolation with the right reason", () => {
    const events: string[] = [];
    const guard = new AgentLoopGuard({
      maxSteps: 1,
      onViolation: (e) => events.push(e.reason),
    });
    guard.check(tool("a"));
    guard.check(tool("b"));
    expect(events).toEqual(["MAX_STEPS_EXCEEDED"]);
  });
});
