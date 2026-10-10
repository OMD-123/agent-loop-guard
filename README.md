# 🛡️ agent-loop-guard-js

**The industry-standard guardrail framework for autonomous AI agents.**

`agent-loop-guard-js` is a high-performance, provider-independent safety layer that protects AI agents from the most common failure modes of agentic workflows: **runaway loops, prompt injections, hallucinations, and unsafe outputs.**

[![npm version](https://img.shields.io/npm/v/agent-loop-guard-js.svg)](https://www.npmjs.com/package/agent-loop-guard-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![CI](https://github.com/OMD-123/agent-loop-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/OMD-123/agent-loop-guard/actions/workflows/ci.yml)

---

## 🚀 Why do you need Guardrails?

Autonomous agents operate in a loop: `LLM → Tool → LLM`. Without guardrails, this loop can fail catastrophically:

- **The Token Burn**: An agent gets stuck calling the same tool 1,000 times in a row.
- **The Jailbreak**: A user tricks your agent into ignoring its system prompt via prompt injection.
- **The Hallucination**: The agent ignores a tool's "Not Found" response and makes up a fake answer.
- **The Logic Fail**: An agent performs an action that violates your core business rules.

`agent-loop-guard-js` sits as a transparent proxy between your agent and its tools, making a binary `allowed: boolean` decision for every single step.

---

## ✨ Key Features (v3.0.0)

| Guardrail | Detects | Use Case |
| :--- | :--- | :--- |
| **Loop Guard** | Max steps, durations, and circular tool patterns. | Stop infinite loops & token drain. |
| **Security Guard** | Prompt injections, jailbreaks, and unsafe content. | Prevent system prompt leakage. |
| **Hallucination Guard**| Contradictions between tool results and LLM output. | Ensure factual grounding. |
| **Logic Guard** | Custom schema or function-based business violations. | Enforce strict business rules. |

### Technical Highlights
- **Zero-Dependency**: No bloat. Works in Node.js, Bun, and Deno.
- **Plugin Architecture**: Add your own custom checkers effortlessly.
- **O(1) Complexity**: History is bounded; it will never crash your process.
- **Provider Agnostic**: Works with OpenAI, Anthropic, Local LLMs, or custom engines.

---

## 📦 Installation

```bash
npm install agent-loop-guard-js
# or
pnpm add agent-loop-guard-js
# or
yarn add agent-loop-guard-js
```

---

## ⚡ Quick Start

```ts
import { Guardrail, LoopChecker, SecurityChecker, BusinessLogicChecker } from 'agent-loop-guard-js';

// 1. Initialize the Guardrail with the checkers you need
const guard = new Guardrail([
  new LoopChecker({ 
    maxSteps: 20, 
    maxRepeatedCalls: 3 
  }),
  new SecurityChecker({ 
    detectInjection: true, 
    blockUnsafeWords: ['malware', 'hack'] 
  }),
  new BusinessLogicChecker({ 
    validator: (step) => step.tool !== 'delete_production_db',
    errorMessage: 'Critical Action Blocked!'
  })
]);

// 2. Start a new agent session
guard.start();

// 3. Check every step before execution
function onAgentStep(step) {
  const decision = guard.check(step);
  
  if (!decision.allowed) {
    console.error(`🛑 Guardrail Blocked: ${decision.reason} - ${decision.message}`);
    throw new Error('Agent safety violation');
  }
  
  // Proceed to execute the tool/LLM call...
}
```

---

## 🛠️ API Reference

### `new Guardrail(checkers: Checker[], onViolation?)`
The main orchestrator. Iterates through all provided checkers. If any checker returns `allowed: false`, the entire step is blocked.

### `Checker` Interface
Implement this interface to create your own custom guards:
```ts
interface Checker {
  name: string;
  check(step: AgentStep, history: AgentStep[]): GuardDecision;
}
```

---

## 📈 Performance & Scale
- **Latency**: Average check time $< 1	ext{ms}$.
- **Memory**: Constant space complexity relative to the `loopPatternWindow`.
- **Throughput**: Capable of handling thousands of steps per second.

---

## 🤝 Contributing
We welcome contributions! Please read the [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions.

## 📄 License
MIT © [OMD-123](https://github.com/OMD-123)
