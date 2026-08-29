import type { Detector, DetectorContext } from "./types.js";
import { deny } from "../core/decisions.js";

/**
 * Detects consecutive calls that are *exactly* identical: same type, same name,
 * AND (when duplicate-argument detection is on) same canonicalized arguments.
 *
 * Counter is stateful but bounded: it only ever holds the count for the current
 * run of identical calls, so it never grows with run length.
 */
export class RepetitionDetector implements Detector {
  readonly name = "Repetition";

  /** Count of consecutive identical candidateKeys seen. */
  private runCount = 0;
  /** The key of the run we are currently counting. */
  private currentKey: string | null = null;

  reset(): void {
    this.runCount = 0;
    this.currentKey = null;
  }

  check(ctx: DetectorContext) {
    const limit = ctx.options.maxRepeatedCalls;
    if (limit <= 0) return null; // disabled

    if (
      this.currentKey !== null &&
      this.currentKey === ctx.candidateKey
    ) {
      this.runCount += 1;
    } else {
      this.currentKey = ctx.candidateKey;
      this.runCount = 1;
    }

    if (this.runCount > limit) {
      const [type, name] = splitKey(ctx.candidateKey);
      return deny("REPEATED_CALL_LIMIT_EXCEEDED", ctx.stepCount, {
        tool: name,
        type,
        maxRepeatedCalls: limit,
      });
    }
    return null;
  }
}

/** Recover type/name from a step key produced by GuardState.stepKey. */
function splitKey(key: string): [string, string] {
  const hash = key.indexOf("#");
  const head = hash === -1 ? key : key.slice(0, hash);
  const sep = head.indexOf(":");
  if (sep === -1) return [head, ""];
  return [head.slice(0, sep), head.slice(sep + 1)];
}
