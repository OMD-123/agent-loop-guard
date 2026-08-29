import { describe, it, expect } from "vitest";
import { canonicalizeKey } from "../src/normalization/canonicalize.js";

describe("canonicalizeKey", () => {
  it("treats reordered object keys as equal", () => {
    expect(canonicalizeKey({ a: 1, b: 2 })).toBe(canonicalizeKey({ b: 2, a: 1 }));
  });

  it("treats nested objects with reordered keys as equal", () => {
    const x = { a: { x: 1, y: 2 }, b: [1, 2, 3] };
    const y = { b: [1, 2, 3], a: { y: 2, x: 1 } };
    expect(canonicalizeKey(x)).toBe(canonicalizeKey(y));
  });

  it("handles arrays positionally", () => {
    expect(canonicalizeKey([1, 2, 3])).not.toBe(canonicalizeKey([3, 2, 1]));
    expect(canonicalizeKey([1, 2, 3])).toBe(canonicalizeKey([1, 2, 3]));
  });

  it("handles primitives", () => {
    expect(canonicalizeKey("x")).toBe(canonicalizeKey("x"));
    expect(canonicalizeKey(42)).toBe(canonicalizeKey(42));
    expect(canonicalizeKey(true)).toBe(canonicalizeKey(true));
    expect(canonicalizeKey(null)).toBe(canonicalizeKey(null));
    expect(canonicalizeKey(undefined)).toBe(canonicalizeKey(undefined));
  });

  it("distinguishes a string '1' from the number 1", () => {
    expect(canonicalizeKey("1")).not.toBe(canonicalizeKey(1));
  });

  it("does not throw on circular references", () => {
    const a: Record<string, unknown> = { name: "root" };
    a.self = a;
    const b: Record<string, unknown> = { name: "root" };
    b.self = b;
    // Both collapse to the circular sentinel -> equal, and no throw.
    expect(() => canonicalizeKey(a)).not.toThrow();
    expect(canonicalizeKey(a)).toBe(canonicalizeKey(b));
  });

  it("handles deep nesting and mixed types", () => {
    // Objects are key-order-insensitive at every depth; arrays keep order.
    // Two values are equal only when nested objects match (key order free)
    // and nested arrays match element-for-element.
    const x = { a: { b: 2, c: [3, "x"] }, d: null, e: undefined };
    const y = { e: undefined, d: null, a: { c: [3, "x"], b: 2 } };
    expect(canonicalizeKey(x)).toBe(canonicalizeKey(y));

    // And a real difference is NOT collapsed to equal.
    const z = { a: { b: 2, c: [3, "y"] }, d: null, e: undefined };
    expect(canonicalizeKey(x)).not.toBe(canonicalizeKey(z));
  });
});
