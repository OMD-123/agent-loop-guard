import { describe, it, expect } from "vitest";
import { canonicalizeKey as canonicalize } from "../../src/normalization/canonicalize";

describe("canonicalize - Unicode & Special Characters", () => {
  it("should handle emoji in arguments", () => {
    const args = { emoji: "🎉", text: "hello" };
    const result = canonicalize(args);
    expect(result).toContain("🎉");
    expect(result).toContain("hello");
  });

  it("should handle Chinese characters", () => {
    const args = { chinese: "你好世界", english: "hello world" };
    const result = canonicalize(args);
    expect(result).toContain("你好世界");
    expect(result).toContain("hello world");
  });

  it("should handle mixed Unicode and ASCII", () => {
    const args = { 
      emoji: "🚀💯", 
      chinese: "测试", 
      arabic: "مرحبا", 
      ascii: "test" 
    };
    const result = canonicalize(args);
    expect(result).toContain("🚀💯");
    expect(result).toContain("测试");
    expect(result).toContain("مرحبا");
    expect(result).toContain("test");
  });

  it("should treat identical Unicode arguments as equal", () => {
    const args1 = { query: "🔍 search" };
    const args2 = { query: "🔍 search" };
    expect(canonicalize(args1)).toBe(canonicalize(args2));
  });

  it("should handle empty strings with Unicode", () => {
    const args = { empty: "", unicode: "🎯" };
    const result = canonicalize(args);
    expect(result).toContain("unicode");
    expect(result).toContain("🎯");
  });

  it("should handle surrogate pairs", () => {
    // 🎯 is a surrogate pair in UTF-16
    const args = { target: "🎯" };
    const result = canonicalize(args);
    expect(result).toContain("🎯");
  });
});