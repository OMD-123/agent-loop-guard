import { describe, it, expect } from "vitest";
import { AgentLoopGuard } from "../../src/index.ts";
import type { AgentStep } from "../../src/types/index.ts";

describe("AgentLoopGuard - Large Argument Objects", () => {
  it("should handle large string arguments", () => {
    const largeString = "x".repeat(100000); // 100KB string
    const guard = new AgentLoopGuard({ maxSteps: 10, maxRepeatedCalls: 1 });
    
    const step: AgentStep = { type: "tool", name: "process", arguments: { data: largeString } };
    const decision = guard.check(step);
    
    // Should allow the step (no repetition yet)
    expect(decision.allowed).toBe(true);
    
    // Second call with same large string should be detected as repetition
    const decision2 = guard.check(step);
    expect(decision2.allowed).toBe(false);
    if (!decision2.allowed) {
      expect(decision2.reason).toMatch(/REPEATED_CALL_LIMIT_EXCEEDED|repeated/);
    }
  });
  
  it("should handle large array arguments", () => {
    const largeArray = Array.from({ length: 50000 }, (_, i) => i);
    const guard = new AgentLoopGuard({ maxSteps: 10, maxRepeatedCalls: 1 });
    
    const step: AgentStep = { type: "tool", name: "process", arguments: { data: largeArray } };
    const decision1 = guard.check(step);
    expect(decision1.allowed).toBe(true);
    
    const decision2 = guard.check(step);
    expect(decision2.allowed).toBe(false);
    if (!decision2.allowed) {
      expect(decision2.reason).toMatch(/REPEATED_CALL_LIMIT_EXCEEDED|repeated/);
    }
  });
  
  it("should handle large nested objects", () => {
    const largeObj = { 
      data: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` })) 
    };
    const guard = new AgentLoopGuard({ maxSteps: 10, maxRepeatedCalls: 1 });
    
    const step: AgentStep = { type: "tool", name: "process", arguments: largeObj };
    const decision1 = guard.check(step);
    expect(decision1.allowed).toBe(true);
    
    const decision2 = guard.check(step);
    expect(decision2.allowed).toBe(false);
    if (!decision2.allowed) {
      expect(decision2.reason).toMatch(/REPEATED_CALL_LIMIT_EXCEEDED|repeated/);
    }
  });
  
  it("should not crash on extremely large objects (within reason)", () => {
    // Create a large but manageable object (1MB string)
    const hugeString = "x".repeat(1_000_000);
    const guard = new AgentLoopGuard({ maxSteps: 5 });
    
    const step: AgentStep = { type: "tool", name: "huge", arguments: { payload: hugeString } };
    
    // Should not throw
    expect(() => guard.check(step)).not.toThrow();
    
    const decision = guard.check(step);
    expect(typeof decision.allowed).toBe("boolean");
  });
});