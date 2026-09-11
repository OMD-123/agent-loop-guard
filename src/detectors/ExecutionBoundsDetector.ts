import type { Detector, DetectorContext, GuardDecision } from "./types";
import { deny } from "../core/decisions";

/**
 * ExecutionBoundsDetector prevents agents from running for too many total steps
 * or exceeding time limits. Unlike MaxStepsDetector which looks at recent activity,
 * this detector tracks cumulative limits across the entire agent session.
 */
export class ExecutionBoundsDetector implements Detector {
  readonly name = "ExecutionBounds";

  reset(): void {
    // No state to reset - we read from GuardState
  }

  check(context: DetectorContext): GuardDecision | null {
    const { state, options, now } = context;
    const maxSteps = options.maxTotalSteps;
    const maxDurationMs = options.maxTotalDurationMs;

    // Check total step count
    if (maxSteps > 0 && state.stepCount >= maxSteps) {
      return deny("MAX_TOTAL_STEPS_EXCEEDED", state.stepCount, { 
        limit: maxSteps,
        current: state.stepCount,
        type: "total-steps"
      });
    }

    // Check total duration
    if (maxDurationMs > 0 && state.startTime !== null) {
      const duration = now - state.startTime;
      if (duration >= maxDurationMs) {
        return deny("MAX_DURATION_EXCEEDED", state.stepCount, { 
          limitMs: maxDurationMs,
          durationMs: duration,
          type: "total-duration"
        });
      }
    }

    return null;
  }
}

/**
 * Detector factory for ExecutionBoundsDetector
 */
export function createExecutionBoundsDetector(): ExecutionBoundsDetector {
  return new ExecutionBoundsDetector();
}
