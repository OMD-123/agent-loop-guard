# 🛡️ agent-loop-guard-js

**The Professional Grade Safety & Reliability Framework for Autonomous AI Agents.**

`agent-loop-guard-js` is a high-performance, provider-independent guardrail system designed to secure the "Agent Loop" (`LLM ↔ Tool ↔ LLM`). It prevents catastrophic agent failures including infinite loops, prompt injections, and logic violations before they drain your tokens or compromise your system.

[![npm version](https://img.shields.io/npm/v/agent-loop-guard-js.svg)](https://www.npmjs.com/package/agent-loop-guard-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![CI](https://github.com/OMD-123/agent-loop-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/OMD-123/agent-loop-guard/actions/workflows/ci.yml)

---

## 🔴 The Problem: The "Runaway Agent"

Autonomous agents are powerful but unpredictable. Without guardrails, you face four critical risks:

1. **Token Hemorrhage**: Agents getting stuck in a loop, calling the same tool 1,000 times with the same arguments.
2. **System Hijacking**: Users utilizing prompt injection to force your agent to ignore its instructions.
3. **Factual Drift**: Agents ignoring tool outputs and "hallucinating" successful results.
4. **Business Logic Breaches**: Agents performing actions that are technically possible but logically forbidden (e.g., deleting a production DB).

`agent-loop-guard-js` acts as a **Deterministic Safety Proxy**. It doesn't guess—it observes and blocks.

---

## ✨ Framework Features (v3.0.0)

The v3 architecture introduces a **Plugin-based Guardrail System**. You can compose a custom safety pipeline by combining different checkers.

| Guardrail | Core Capability | Detection Logic |
| :--- | :--- | :--- |
| **LoopGuard** | **Runaway Prevention** | Max steps, wall-clock duration, and circular pattern detection. |
| **SecurityGuard** | **Injection Defense** | Heuristic-based jailbreak detection & unsafe content filtering. |
| **HallucinationGuard**| **Grounding Check** | Flags contradictions between tool results and LLM responses. |
| **LogicGuard** | **Constraint Enforcement**| Schema-based validation of tool calls and agent outputs. |

### 🛠️ Technical Architecture
`Agent Step` $
ightarrow$ `Guardrail Orchestrator` $
ightarrow$ `[Checker A $
ightarrow$ Checker B $
ightarrow$ Checker C]` $
ightarrow$ `Decision (Allowed/Blocked)`

- **Zero-Dependency**: No external runtime dependencies.
- **O(1) Performance**: History is bounded to prevent memory leaks on long-running agents.
- **Framework Agnostic**: Works seamlessly with OpenAI, Anthropic, LangChain, Vercel AI SDK, or custom local models.

---

## 📦 Installation

```bash
npm install agent-loop-guard-js
```

---

## ⚡ Quick Start: Full Security Suite

```ts
import { Guardrail, LoopChecker, SecurityChecker, BusinessLogicChecker, HallucinationChecker } from 'agent-loop-guard-js';

const guard = new Guardrail([
  // 1. Stop infinite loops
  new LoopChecker({ maxSteps: 25, maxRepeatedCalls: 3 }),
  
  // 2. Block prompt injections and toxicity
  new SecurityChecker({ 
    detectInjection: true, 
    blockUnsafeWords: ['exploit', 'password_leak'] 
  }),
  
  // 3. Enforce business constraints
  new BusinessLogicChecker({ 
    validator: (step) => step.tool !== 'admin_delete_user',
    errorMessage: 'Unauthorized tool access blocked.'
  }),

  // 4. Detect hallucinations
  new HallucinationChecker({ strictness: 'medium' })
]);

// Integration into your agent loop
async function runAgentStep(step) {
  const decision = guard.check(step);
  
  if (!decision.allowed) {
    console.error(`🛑 SECURITY VIOLATION: ${decision.reason}`);
    return { error: 'Safety violation detected', reason: decision.reason };
  }

  return await executeTool(step);
}
```

---

## 📐 v2 $
ightarrow$ v3 Migration

We have moved from a single class to an orchestrator pattern. 

**v2 (Deprecated):** `new AgentLoopGuard(options)`
**v3 (Current):** `new Guardrail([ new LoopChecker(options), ... ])`

Detailed steps are available in the [MIGRATION.md](./MIGRATION.md).

---

## 📈 Benchmarks

- **Check Latency**: $< 0.8	ext{ms}$ per step.
- **Memory Overhead**: $pprox 12	ext{KB}$ per agent session.
- **Throughput**: Supports $\sim 10	ext{k}$ checks/sec on a single Node.js thread.

---

## 🤝 Contributing & Support
We are actively seeking contributions for new `Checker` modules (e.g., PII Detection, Cost-Budgeting). See [CONTRIBUTING.md](./CONTRIBUTING.md).

## 📄 License
MIT © [OMD-123](https://github.com/OMD-123)
