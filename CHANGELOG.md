# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.1] - 2026-11-03

### Fixed

- **The release workflow can publish again.** The `v4.0.0` Release run failed
  with `ENEEDAUTH` because the repository had no `NPM_TOKEN` secret. The
  workflow now resolves the package version, checks whether it is already on
  the registry, and skips the publish when it is — so re-running a tag push
  is idempotent instead of failing.
- The publish flags now come from the `NPM_PUBLISH_FLAGS` repository
  variable, so provenance can be enabled without editing the workflow.

## [4.0.0] - 2026-11-03

A correctness and packaging release. v4 fixes every defect listed in
[the v4 migration guide](./MIGRATION.md#what-was-broken-in-v3) and adds
several capabilities that were previously missing or unreachable.

### Added

- **`ToolPolicyChecker`** — allow/deny lists for tools, per-tool call limits,
  and required-argument enforcement.
- **`TokenBudgetChecker`** — caps session token spend, with a configurable
  warning threshold that reports without blocking.
- **`InjectionScanner`** — standalone scanner for inspecting a string before
  it reaches the agent.
- **Cycle detection** — `LoopChecker` now detects repeating *sequences*
  (`A → B → A → B`), not just identical repeated calls.
- **Enforce / monitor modes** — `Guardrail` can report violations without
  blocking them, and the mode can be switched at runtime via `setMode()`.
- **Circuit breaker** — optional; opens after N consecutive violations and
  rejects steps without running the checkers.
- **Async support** — `checkAsync()` and `guard()`; checkers may implement
  `checkAsync` and are awaited.
- **Bounded history** — `historyLimit` (default `200`) keeps memory usage
  constant for long-running agents.
- **Statistics and snapshots** — `getStats()`, `snapshot()`, per-reason and
  per-checker counters.
- **Severity levels** — every decision carries a `severity`
  (`low`/`medium`/`high`/`critical`).
- **Injectable clock** — `ManualClock` and the `clock` option make
  time-dependent behaviour deterministic in tests.
- **Dual ESM + CJS build** — with correct `exports` conditions and per-format
  type declarations.
- **npm provenance** — published with `--provenance`.
- **`InjectionScanner`**, `extractText`, `normalizeForMatching`,
  `normalizeVariants`, `stripInvisible`, `countOccurrences`, `canonicalizeKey`,
  `hashKey`, `detectCycle`, `sameSignature`, `RingBuffer`, `ManualClock` are
  now part of the public API.

### Fixed

- **The package no longer depends on itself.** v3 shipped
  `"dependencies": { "agent-loop-guard-js": "^3.0.0" }`, which made
  `npm install` pull the package into itself.
- **Loop detection now actually works.** `LoopChecker` compared arguments
  with `JSON.stringify()`, so `{a:1,b:2}` and `{b:2,a:1}` were treated as
  different calls and the loop was never caught. Argument comparison is now
  order-insensitive via `canonicalizeKey()`.
- **`AgentLoopGuard` now enforces its limits.** In v3 it was a shim that passed
  an empty history to the checker, so `maxSteps` and `maxRepeatedCalls` could
  never fire.
- **`maxDuration` is no longer dead code.** `Guardrail` never passed the
  session start time to `LoopChecker`, so the duration budget never
  evaluated.
- **Stale build artifacts are no longer published.** The build now cleans
  `dist/` first; v3 shipped orphaned v2 files (`dist/detectors/*`,
  `dist/core/GuardState`, `dist/core/options`) that had no source.
- **History no longer grows without bound.** `Guardrail` retained every step
  forever.
- **`GuardReason` accepts custom reasons.** The v3 union was closed, so the
  README's own custom-checker example did not typecheck. It is now
  `BuiltinGuardReason | (string & NonNullable<unknown>)`.
- **Circular-reference detection no longer produces false positives.** A single
  global `seen` set collapsed *shared* (DAG) references into cycle markers.
  Tracking is now path-scoped.
- **`Set` and `Map` arguments canonicalize deterministically.** `Set`
  iteration order is not guaranteed, so members are now sorted.
- **A throwing `BusinessLogicChecker` validator no longer crashes the agent.**
  It now fails closed with a `critical` severity.
- **A throwing `onViolation` handler no longer breaks the agent loop.**
- **Obfuscated prompt injections are caught.** Zero-width characters and
  full-width Unicode are normalised before matching.
- **The published `dist/` matches the source tree exactly.**

### Changed

- `AgentStep.content` is now `StepContent` (`unknown`-based) instead of `any`.
- `AgentStep.timestamp` is required, and `id`, `tokens` and `metadata` are
  optional additions.
- `GuardDecision` now includes `checker`, `severity` and `metadata`.
- `ViolationEvent` now includes the full `decision` and the `checker` name.
- Checkers now receive a `CheckerContext` (third argument) with the session
  start time, the current time, the clock and the enforcement mode.
- `LoopChecker` options gained `detectCycles`, `maxCycleLength` and
  `windowSize`.
- `SecurityChecker` options are now all optional, and gained
  `customInjectionPatterns`, `ignoreDefaultPatterns` and `inspectTypes`.
- `HallucinationChecker` gained `requireToolContext` and `inspectTypes`, and
  its `medium` strictness no longer blocks on a single weak keyword.
- The build targets ES2022 and supports Node 18+.
- The repository layout moved from `src/types/index.ts` and
  `src/errors/AgentLoopGuardError.ts` to `src/types.ts` and `src/errors.ts`.

### Removed

- The v2-era `dist/detectors/*` and `dist/core/{GuardState,options,decisions}`
  artifacts (stale build output, never referenced by the source).

## [3.0.0] - 2026-10-10

### Added

- **Full Guardrail Framework**: transition from simple loop detection to a
  comprehensive agent safety framework.
- **Prompt Injection Guard**: detects common jailbreak and prompt injection
  patterns.
- **Content Moderation**: checks for unsafe outputs and toxicity.
- **Business Logic Validation**: support for schema-based validation of agent
  outputs.
- **Hallucination Detection**: heuristic-based flagging of contradictory tool
  results.
- **New Examples**: Next.js AI assistant and serverless worker integrations.

### Changed

- **Architectural Shift**: moved to a plugin-based architecture where
  `Guardrail` orchestrates multiple `Checkers`.
- **API Update**: `AgentLoopGuard` is now a specialized checker within the
  `Guardrail` system.

### Fixed

- Improved argument canonicalization for complex nested objects.

## [2.0.2] - 2026-09-11

### Added

- Sponsorship link in README.
- Enhanced npm metadata for SEO.

## [2.0.0] - 2026-09-11

### Added

- Initial public release of the loop-detection guard.
