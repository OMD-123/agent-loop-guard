# Security Policy

## Supported Versions

| Version | Supported |
| :--- | :--- |
| 4.x | ✅ |
| 3.x | ❌ |
| < 3.x | ❌ |

v3 contains known correctness defects (see [MIGRATION.md](./MIGRATION.md)),
including a loop-detection path that did not detect loops. Upgrade to v4.

---

## Reporting a Vulnerability

**Do not open a public issue for security problems.**

Use GitHub's private vulnerability reporting:

> **Security** tab → **Report a vulnerability**

This opens a private advisory visible only to the maintainer. You will get an
acknowledgement within 72 hours and a status update within 7 days.

If private reporting is unavailable, email **omd4485@gmail.com** with the
subject `[agent-loop-guard] security report`. Please do not include
exploit details in a public issue, a gist, or a tweet.

### What to include

- Type of issue (prototype pollution, ReDoS, bypass of a guardrail, …)
- Affected version
- Minimal reproduction
- Impact assessment

### What to expect

| Stage | Target |
| :--- | :--- |
| Acknowledgement | 72 hours |
| Triage and severity assessment | 7 days |
| Fix released | 14 days for critical/high |
| Public advisory | On fix, credited to the reporter unless you prefer anonymity |

---

## Scope

### In scope

- Bypassing a guardrail check that the documentation says will block.
- Crashing the host agent through malformed input (the guard must never throw
  into user code).
- Prototype pollution through argument canonicalization.
- ReDoS (catastrophic backtracking) in the built-in patterns.
- Leaking data between guard instances or sessions.
- Path traversal or arbitrary file access in the build/publish pipeline.

### Out of scope

- The heuristics being *imperfect*. `SecurityChecker` and
  `HallucinationChecker` are documented as heuristics. A prompt injection that
  evades a known pattern is a **detection gap**, not a vulnerability, unless
  it can be shown to defeat the documented guarantees.
- Denial of service from a deliberately huge `historyLimit` configured by the
  integrator.
- Issues in the agent framework the guard is used with.

---

## Security Properties

The library is designed with the following guarantees:

1. **Never throws into host code.** Every checker catches its own errors and
   fails closed. A throwing `onViolation` handler is swallowed rather than
   propagated.
2. **No prototype pollution.** Argument canonicalization only ever *reads*
   object keys; it never assigns to them. `__proto__` keys are treated as
   ordinary string keys.
3. **No code execution.** There is no `eval`, no `new Function`, and no
   dynamic `require`. The package has zero runtime dependencies.
4. **Bounded resource use.** History is a fixed-size ring buffer, recursion
   depth is capped, and content extraction stops at a maximum depth and length.
5. **No network or filesystem access.** The library is pure computation.
6. **No telemetry.** Nothing is sent anywhere.

---

## Supported Deployment

The package is designed for trusted-server-side use — the guard and the agent
run in the same process. It is **not** designed to run in an untrusted
multi-tenant environment where different tenants share a process, because
step content from one tenant could be visible to another through shared
state. Use one guard instance per session.

---

## Best Practices

- **Pin the version.** Use `^4.0.0` or an exact version.
- **Verify the package provenance.** Releases are published with npm
  provenance; `npm audit signatures` can confirm the publisher.
- **Do not treat the guard as the only control.** It is one layer. Keep your
  own authorization checks, especially for destructive tools.
- **Run in `monitor` mode first.** Roll out new rules in monitor mode and
  review the violations before enforcing them.
- **Keep `historyLimit` bounded.** The default of `200` is appropriate for
  most agents.
