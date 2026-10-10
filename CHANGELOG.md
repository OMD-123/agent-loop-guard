# Changelog

All notable changes to this project will be documented in this file.

## [3.0.0] - 2026-10-10
### Added
- **Full Guardrail Framework**: Transitioned from simple loop detection to a comprehensive agent safety framework.
- **Prompt Injection Guard**: Detects common jailbreak and prompt injection patterns.
- **Content Moderation**: Integrated checks for unsafe outputs and toxicity.
- **Business Logic Validation**: Support for schema-based validation of agent outputs.
- **Hallucination Detection**: Heuristic-based flagging of contradictory tool results.
- **Performance Benchmarks**: Added benchmarks for per-step latency and memory growth.
- **New Examples**: Added Next.js AI assistant and serverless worker integrations.

### Changed
- **Architectural Shift**: Moved to a plugin-based architecture where `Guardrail` orchestrates multiple `Checkers`.
- **API Update**: `AgentLoopGuard` is now a specialized checker within the `Guardrail` system.

### Fixed
- Improved argument canonicalization for complex nested objects.

## [2.0.2] - 2026-09-11
### Added
- Sponsorship link in README.
- Enhanced npm metadata for SEO.
