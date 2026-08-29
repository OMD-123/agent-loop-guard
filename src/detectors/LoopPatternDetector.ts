import type { Detector, DetectorContext } from "./types.js";
import { deny } from "../core/decisions.js";

/**
 * Detects short repeating *sequences* of steps — not just consecutive
 * identical calls. Examples:
 *   A, B, A, B, A, B        (period 2)
 *   A, B, C, A, B, C, A     (period 3)
 *
 * Algorithm (per candidate step, O(window) work, no extra state):
 *   Given window length W and history H (already containing W-1 prior keys),
 *   we test every period p in [1 .. floor(W/2)]. For a period p to be a valid
 *   repeating cycle across the full W keys, the last entry must equal the entry
 *   p steps back, and so on. The smallest period that explains the whole window
 *   as a repetition of its first p keys is reported.
 *
 * This is deliberately conservative: it only flags when the ENTIRE window is a
 * clean repetition, which avoids false positives on long aperiodic runs.
 * Memory stays bounded because we only ever look at the trailing window.
 */
export class LoopPatternDetector implements Detector {
  readonly name = "LoopPattern";

  reset(): void {
    // Stateless: reads trailing history from GuardState.
  }

  check(ctx: DetectorContext) {
    const window = ctx.options.loopPatternWindow;
    if (window <= 0) return null; // disabled

    const hist = ctx.state.history;
    // We need `window` consecutive keys: the W-1 prior ones plus the candidate.
    if (hist.length < window - 1) return null;

    const tail: string[] = [];
    for (let i = hist.length - (window - 1); i < hist.length; i++) {
      tail.push(hist[i] as string);
    }
    tail.push(ctx.candidateKey);

    const period = findRepeatingPeriod(tail);
    if (period !== null) {
      return deny("LOOP_PATTERN_DETECTED", ctx.stepCount, {
        period,
        window,
        pattern: tail.slice(0, period),
      });
    }
    return null;
  }
}

/**
 * Return the smallest period `p` such that `seq` is exactly `seq[0..p-1]`
 * repeated, or `null` if the sequence is not a clean repetition.
 */
function findRepeatingPeriod(seq: string[]): number | null {
  const n = seq.length;
  const maxP = Math.floor(n / 2);
  for (let p = 1; p <= maxP; p++) {
    if (n % p !== 0) continue; // a full repetition requires n divisible by p
    let ok = true;
    for (let i = 0; i < n; i++) {
      if (seq[i] !== seq[i % p]) {
        ok = false;
        break;
      }
    }
    if (ok) return p;
  }
  return null;
}
