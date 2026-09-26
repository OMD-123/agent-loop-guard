import { describe, it, expect } from "vitest";
import { canonicalizeKey } from "../../src/normalization/canonicalize";

describe("canonicalizeKey - Deep Nesting", () => {
  it("should handle deeply nested objects", () => {
    const args = { a: { b: { c: { d: { e: "deep" } } } } };
    const result = canonicalizeKey(args);
    expect(result).toContain("deep");
    expect(result).toContain("a");
    expect(result).toContain("b");
    expect(result).toContain("c");
    expect(result).toContain("d");
    expect(result).toContain("e");
  });

  it("should handle deeply nested arrays", () => {
    const args = { data: [1, [2, [3, [4, [5]]]]] };
    const result = canonicalizeKey(args);
    expect(result).toContain("data");
    expect(result).toContain("1");
    expect(result).toContain("5");
  });

  it("should handle mixed deep nesting (objects and arrays)", () => {
    const args = { 
      users: [
        { name: "Alice", meta: { tags: ["admin", "active"] } },
        { name: "Bob", meta: { tags: ["user"] } }
      ]
    };
    const result = canonicalizeKey(args);
    expect(result).toContain("Alice");
    expect(result).toContain("Bob");
    expect(result).toContain("admin");
    expect(result).toContain("user");
  });

  it("should produce same key for same structure regardless of creation order", () => {
    const args1 = { a: { b: { c: 1 } } };
    const args2 = { a: { b: { c: 1 } } };
    expect(canonicalizeKey(args1)).toBe(canonicalizeKey(args2));
  });

  it("should handle maximum depth gracefully", () => {
    // Create object at depth ~70 (should be handled by depth limit)
    let obj: any = { value: "bottom" };
    for (let i = 0; i < 70; i++) {
      obj = { level: i, child: obj };
    }
    // Should not throw, should return circular sentinel for deep parts
    const result = canonicalizeKey(obj);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("should treat different deep structures as different", () => {
    const args1 = { a: { b: { c: 1 } } };
    const args2 = { a: { b: { c: 2 } } };
    expect(canonicalizeKey(args1)).not.toBe(canonicalizeKey(args2));
  });
});