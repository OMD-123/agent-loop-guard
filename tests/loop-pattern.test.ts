import { describe, it, expect } from "vitest";
import { AgentLoopGuard } from "../src/index.js";
import { isBlocked } from "./_helpers.js";
import type { AgentStep } from "../src/types/index.js";

const step = (name: string): AgentStep => ({ type: "tool", name });

function run(names: string[]) {
  const guard = new AgentLoopGuard({ loopPatternWindow: 6 });
  let last = guard.check(step(names[0]!));
  for (let i = 1; i < names.length; i++) {
    last = guard.check(step(names[i]!));
    if (isBlocked(last)) break;
  }
  return last;
}

describe("LoopPatternDetector (loopPatternWindow)", () => {
  it("detects a period-2 loop A B A B ...", () => {
    const res = run(["A", "B", "A", "B", "A", "B"]);
    expect(res.allowed).toBe(false);
    if (isBlocked(res)) {
      expect(res.reason).toBe("LOOP_PATTERN_DETECTED");
      expect(res.details?.period).toBe(2);
    }
  });

  it("detects a period-3 loop A B C A B C ...", () => {
    const res = run(["A", "B", "C", "A", "B", "C", "A"]);
    expect(res.allowed).toBe(false);
    if (isBlocked(res)) {
      expect(res.reason).toBe("LOOP_PATTERN_DETECTED");
      expect(res.details?.period).toBe(3);
    }
  });

  it("does not flag a non-looping sequence", () => {
    const res = run(["A", "B", "C", "D", "E", "F"]);
    expect(res.allowed).toBe(true);
  });

  it("does not flag partial/short sequences", () => {
    const res = run(["A", "B", "A"]); // not enough length to fill window
    expect(res.allowed).toBe(true);
  });

  it("respects a custom window size", () => {
    const guard = new AgentLoopGuard({ loopPatternWindow: 4 });
    expect(guard.check(step("A")).allowed).toBe(true); // 1
    expect(guard.check(step("B")).allowed).toBe(true); // 2
    expect(guard.check(step("A")).allowed).toBe(true); // 3
    const res = guard.check(step("B")); // 4 -> window of 4 fully repeats
    expect(res.allowed).toBe(false);
    if (isBlocked(res)) expect(res.reason).toBe("LOOP_PATTERN_DETECTED");
  });

  it("does not false-positive on a long aperiodic sequence", () => {
    const guard = new AgentLoopGuard({ loopPatternWindow: 6 });
    const names = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    let blocked = false;
    for (const n of names) {
      if (!guard.check(step(n)).allowed) {
        blocked = true;
        break;
      }
    }
    expect(blocked).toBe(false);
  });

  it("is disabled when loopPatternWindow is 0 (default)", () => {
    const guard = new AgentLoopGuard();
    for (const n of ["A", "B", "A", "B", "A", "B", "A", "B"]) {
      expect(guard.check(step(n)).allowed).toBe(true);
    }
  });
});
