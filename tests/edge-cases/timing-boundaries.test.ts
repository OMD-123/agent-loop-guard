import { describe, it, expect } from "vitest";
import { AgentLoopGuard } from "../../src/index.ts";
import type { AgentStep, GuardDecision } from "../../src/types/index.ts";

describe("AgentLoopGuard - Timing Boundaries", () => {
  it("should respect maxDuration with rapid calls", () => {
    const guard = new AgentLoopGuard({ maxDuration: 100 }); // 100ms
    const step: AgentStep = { type: "tool", name: "fast", arguments: {} };
    
    guard.start();
    let count = 0;
    // Make rapid calls for ~50ms of wall time
    const startTime = Date.now();
    while (Date.now() - startTime < 50) {
      guard.check(step);
      count++;
    }
    guard.end();
    
    // Should have made multiple calls within duration
    expect(count).toBeGreaterThan(0);
    const stats = guard.stats();
    expect(stats.duration).toBeLessThan(150); // Should not exceed by too much
  });
  
  it("should stop when maxDuration exceeded", () => {
      const guard = new AgentLoopGuard({ maxDuration: 50 }); // 50ms
      const step: AgentStep = { type: "tool", name: "slow", arguments: {} };
    
      guard.start();
      // Give the guard a moment to capture startTime, then set step timestamp
      // well past the maxDuration to guarantee the DurationDetector triggers.
      // We advance the step's timestamp on each iteration to simulate elapsed time.
      let decision: GuardDecision;
      let iterations = 0;
      const baseTime = Date.now(); // Use wall clock as stable baseline
      do {
        // Set timestamp to simulate time passing: 60ms, 70ms, 80ms... past baseTime
        // The guard's startTime is captured at guard.start() which happened ~now
        step.timestamp = baseTime + 60 + iterations * 10;
        decision = guard.check(step);
        iterations++;
        // Safety break to avoid infinite loop in test
        if (iterations > 10000) break;
      } while (decision.allowed && iterations < 10); // Max 10 iterations
      guard.end();
    
      // Should have stopped due to time
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.reason).toMatch(/MAX_DURATION_EXCEEDED|duration/);
      }
    });
  
  it("should handle zero maxDuration (unlimited)", () => {
    const guard = new AgentLoopGuard({ maxDuration: 0 }); // Unlimited
    const step: AgentStep = { type: "tool", name: "unlimited", arguments: {} };
    
    guard.start();
    // Should allow many steps (we'll do 1000)
    for (let i = 0; i < 1000; i++) {
      const decision = guard.check(step);
      expect(decision.allowed).toBe(true);
    }
    guard.end();
    
    const stats = guard.stats();
    expect(stats.stepCount).toBe(1000);
  });
  
  it("should handle very small maxDuration", () => {
    const guard = new AgentLoopGuard({ maxDuration: 1 }); // 1ms
    const step: AgentStep = { type: "tool", name: "instant", arguments: {} };
    
    guard.start();
    const decision = guard.check(step);
    guard.end();
    
    // Should allow at least one step
    expect(decision.allowed).toBe(true);
  });
});