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
      // Check until duration exceeded or max iterations
      let decision: GuardDecision;
      let iterations = 0;
      // Use monotonic clock like the guard does
      const perf = (globalThis as { performance?: { now(): number } }).performance;
      const nowMonotonic = () => perf ? perf.now() : Date.now();
      const start = nowMonotonic();
      do {
        // Add small delay to ensure time passes on fast CI runners
        if (iterations > 0) {
          // Use step timestamp to control time
          step.timestamp = nowMonotonic();
        }
        decision = guard.check(step);
        iterations++;
        // Safety break to avoid infinite loop in test
        if (iterations > 10000) break;
      } while (decision.allowed && (nowMonotonic() - start) < 200); // Try for 200ms max
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