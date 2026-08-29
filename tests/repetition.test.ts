import { describe, it, expect } from "vitest";
import { AgentLoopGuard } from "../src/index.js";
import { isBlocked } from "./_helpers.js";
import type { AgentStep } from "../src/types/index.js";

const call = (args: unknown): AgentStep => ({
  type: "tool",
  name: "web_search",
  arguments: args,
});

describe("RepetitionDetector (maxRepeatedCalls)", () => {
  it("allows different calls", () => {
    const guard = new AgentLoopGuard({ maxRepeatedCalls: 3 });
    expect(guard.check(call({ q: "a" })).allowed).toBe(true);
    expect(guard.check(call({ q: "b" })).allowed).toBe(true);
    expect(guard.check(call({ q: "c" })).allowed).toBe(true);
  });

  it("allows the same call up to the limit (limit is inclusive)", () => {
    const guard = new AgentLoopGuard({ maxRepeatedCalls: 3 });
    expect(guard.check(call({ q: "x" })).allowed).toBe(true); // 1
    expect(guard.check(call({ q: "x" })).allowed).toBe(true); // 2
    expect(guard.check(call({ q: "x" })).allowed).toBe(true); // 3 == limit
  });

  it("blocks the step beyond the repeated-call limit", () => {
    const guard = new AgentLoopGuard({ maxRepeatedCalls: 3 });
    guard.check(call({ q: "x" }));
    guard.check(call({ q: "x" }));
    guard.check(call({ q: "x" }));
    const fourth = guard.check(call({ q: "x" }));
    expect(fourth.allowed).toBe(false);
    if (isBlocked(fourth)) {
      expect(fourth.reason).toBe("REPEATED_CALL_LIMIT_EXCEEDED");
      expect(fourth.details?.tool).toBe("web_search");
    }
  });

  it("counts identical objects regardless of key order", () => {
    const guard = new AgentLoopGuard({ maxRepeatedCalls: 2 });
    expect(guard.check(call({ a: 1, b: 2 })).allowed).toBe(true);
    expect(guard.check(call({ b: 2, a: 1 })).allowed).toBe(true);
    const third = guard.check(call({ a: 1, b: 2 }));
    expect(third.allowed).toBe(false);
    if (isBlocked(third)) expect(third.reason).toBe("REPEATED_CALL_LIMIT_EXCEEDED");
  });

  it("resets the run when arguments change", () => {
    const guard = new AgentLoopGuard({ maxRepeatedCalls: 2 });
    guard.check(call({ q: "x" }));
    guard.check(call({ q: "x" }));
    guard.check(call({ q: "y" })); // resets counter
    guard.check(call({ q: "x" }));
    guard.check(call({ q: "x" }));
    const third = guard.check(call({ q: "x" }));
    expect(third.allowed).toBe(false); // 3rd time for x
  });

  it("ignores arguments when detectDuplicateArguments is false", () => {
    const guard = new AgentLoopGuard({
      maxRepeatedCalls: 2,
      detectDuplicateArguments: false,
    });
    guard.check(call({ q: "x" }));
    guard.check(call({ q: "y" })); // diff args, but args ignored -> same key
    const third = guard.check(call({ q: "z" }));
    expect(third.allowed).toBe(false);
    if (isBlocked(third)) expect(third.reason).toBe("REPEATED_CALL_LIMIT_EXCEEDED");
  });
});
