import { describe, it, expect } from "vitest";
import { canonicalizeKey } from "../../src/normalization/canonicalize";

describe("canonicalizeKey - Circular References", () => {
  it("should handle self-referencing object", () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    
    // Should not throw
    const result = canonicalizeKey(obj);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    
    // Same object should produce same key
    const obj2: any = { a: 1 };
    obj2.self = obj2;
    expect(canonicalizeKey(obj2)).toBe(result);
  });

  it("should handle circular reference in nested object", () => {
    const obj: any = { a: { b: 2 } };
    obj.a.parent = obj;
    
    const result = canonicalizeKey(obj);
    expect(typeof result).toBe("string");
    
    // Same structure
    const obj2: any = { a: { b: 2 } };
    obj2.a.parent = obj2;
    expect(canonicalizeKey(obj2)).toBe(result);
  });

  it("should handle circular array", () => {
    const arr: any[] = [1, 2];
    arr.push(arr);
    
    const result = canonicalizeKey({ data: arr });
    expect(typeof result).toBe("string");
    
    // Same structure
    const arr2: any[] = [1, 2];
    arr2.push(arr2);
    expect(canonicalizeKey({ data: arr2 })).toBe(result);
  });

  it("should handle complex circular structure", () => {
    const obj1: any = { name: "obj1" };
    const obj2: any = { name: "obj2" };
    obj1.ref = obj2;
    obj2.ref = obj1;
    
    const result = canonicalizeKey({ obj1, obj2 });
    expect(typeof result).toBe("string");
    
    // Same structure
    const obj1b: any = { name: "obj1" };
    const obj2b: any = { name: "obj2" };
    obj1b.ref = obj2b;
    obj2b.ref = obj1b;
    expect(canonicalizeKey({ obj1: obj1b, obj2: obj2b })).toBe(result);
  });

  it("should treat different circular structures as different", () => {
    const obj1: any = { a: 1 };
    obj1.self = obj1;
    
    const obj2: any = { a: 2 };
    obj2.self = obj2;
    
    expect(canonicalizeKey(obj1)).not.toBe(canonicalizeKey(obj2));
  });

  it("should handle mixed circular and normal data", () => {
    const obj: any = { normal: "value", count: 42 };
    obj.circular = obj;
    
    const result = canonicalizeKey(obj);
    expect(result).toContain("normal");
    expect(result).toContain("value");
    expect(result).toContain("count");
    expect(result).toContain("42");
  });
});