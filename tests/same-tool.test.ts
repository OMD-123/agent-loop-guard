import { describe, it, expect } from "vitest";
import { AgentLoopGuard } from "../src/index.js";
import { isBlocked } from "./_helpers.js";
import type { AgentStep } from "../src/types/index.js";

const tool = (name: string, args?: unknown): AgentStep =>
  args === undefined ? { type: "tool", name } : { type: "tool", name, arguments: args };

describe("SameToolDetector (maxSameToolCalls)", () => {
  it("allows up to the same-tool limit across different arguments", () => {
    const guard = new AgentLoopGuard({ maxSameToolCalls: 3 });
    expect(guard.check(tool("search", { q: "a" })).allowed).toBe(true); // 1
    expect(guard.check(tool("search", { q: "b" })).allowed).toBe(true); // 2
    expect(guard.check(tool("search", { q: "c" })).allowed).toBe(true); // 3 == limit
  });

  it("blocks a tool called more than maxSameToolCalls times in a row", () => {
    const guard = new AgentLoopGuard({ maxSameToolCalls: 3 });
    guard.check(tool("search", { q: "a" }));
    guard.check(tool("search", { q: "b" }));
    guard.check(tool("search", { q: "c" }));
    const fourth = guard.check(tool("search", { q: "d" }));
    expect(fourth.allowed).toBe(false);
    if (isBlocked(fourth)) {
      expect(fourth.reason).toBe("SAME_TOOL_LIMIT_EXCEEDED");
      expect(fourth.details?.tool).toBe("search");
    }
  });

  it("treats different tools as separate counters", () => {
    const guard = new AgentLoopGuard({ maxSameToolCalls: 2 });
    guard.check(tool("a"));
    guard.check(tool("a")); // 2 for a (== limit)
    guard.check(tool("b")); // resets a's counter
    guard.check(tool("a")); // 1 for a again
    guard.check(tool("a")); // 2 for a again (== limit)
    const third = guard.check(tool("a"));
    expect(third.allowed).toBe(false);
  });

  it("breaks the run when an llm step appears between tool calls", () => {
    const guard = new AgentLoopGuard({ maxSameToolCalls: 2 });
    guard.check(tool("search"));
    guard.check(tool("search"));
    expect(guard.check({ type: "llm", name: "gpt" }).allowed).toBe(true);
    expect(guard.check(tool("search")).allowed).toBe(true); // run restarts
    expect(guard.check(tool("search")).allowed).toBe(true);
    expect(guard.check(tool("search")).allowed).toBe(false);
  });

  it("does not apply to llm or custom steps", () => {
    const guard = new AgentLoopGuard({ maxSameToolCalls: 2 });
    expect(guard.check({ type: "llm", name: "x" }).allowed).toBe(true);
    expect(guard.check({ type: "llm", name: "x" }).allowed).toBe(true);
    expect(guard.check({ type: "llm", name: "x" }).allowed).toBe(true); // not blocked
  });
});
