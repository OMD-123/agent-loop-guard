import type { Detector, DetectorContext, GuardDecision } from "./types";
import { deny } from "../core/decisions";

/**
 * RateLimiterDetector prevents agents from making too many calls to the same
 * tool or LLM in total. This helps prevent API abuse and rate limiting
 * issues with external services by limiting the total number of calls.
 */
export class RateLimiterDetector implements Detector {
  readonly name = "RateLimiter";

  reset(): void {
    // No internal state - we compute from history
  }

  check(context: DetectorContext): GuardDecision | null {
    const { state, options, candidate } = context;
    
    // Only check tool and LLM calls
    if (candidate.type !== "tool" && candidate.type !== "llm") {
      return null;
    }
    
    // Get the maximum total calls allowed (tool + LLM)
    const maxTotalCalls = options.maxTotalCalls;
    
    // Total calls = tool calls + LLM calls
    const totalCalls = state.toolCalls + state.llmCalls;
    if (maxTotalCalls > 0 && totalCalls >= maxTotalCalls) {
      return deny("RATE_LIMIT_EXCEEDED", state.stepCount, { 
        limit: maxTotalCalls,
        current: totalCalls,
        type: "total-calls"
      });
    }
    
    return null;
  }
}

/**
 * Detector factory for RateLimiterDetector
 */
export function createRateLimiterDetector(): RateLimiterDetector {
  return new RateLimiterDetector();
}
