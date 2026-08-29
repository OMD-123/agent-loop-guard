import { describe, it, expect } from "vitest";
import { AgentLoopGuard } from "../src/index.js";
import { isBlocked } from "./_helpers.js";
import type { AgentStep } from "../src/types/index.js";

const tool = (name: string, ts?: number): AgentStep =>
  ts === undefined ? { type: "tool", name } : { type: "tool", name, timestamp: ts };

describe("DurationDetector", () => {
  it("blocks when the elapsed time exceeds maxDuration", () => {
    // No explicit start(): lazy start aligns run start to the first step's
    // (agent-provided) timestamp, so elapsed is measured on the same clock.
    const guard = new AgentLoopGuard({ maxDuration: 100 });
    expect(guard.check(tool("a", 0)).allowed).toBe(true);
    expect(guard.check(tool("a", 50)).allowed).toBe(true);
    const blocked = guard.check(tool("a", 200));
    expect(blocked.allowed).toBe(false);
    if (isBlocked(blocked)) expect(blocked.reason).toBe("MAX_DURATION_EXCEEDED");
  });

  it("allows up to exactly the limit", () => {
    const guard = new AgentLoopGuard({ maxDuration: 100 });
    expect(guard.check(tool("a", 0)).allowed).toBe(true);
    expect(guard.check(tool("a", 100)).allowed).toBe(true);
  });

  it("is disabled by default", () => {
    const guard = new AgentLoopGuard();
    guard.start();
    for (let t = 0; t < 100_000; t += 50) {
      expect(guard.check(tool("a", t)).allowed).toBe(true);
    }
  });

  it("only starts counting after start()", () => {
    const guard = new AgentLoopGuard({ maxDuration: 10 });
    // No start() -> startTime is null -> duration checks are skipped.
    expect(guard.check(tool("a")).allowed).toBe(true);
  });
});
