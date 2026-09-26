---
name: Good First Issue - Add More Usage Examples
about: Add more practical examples to the examples/ directory
title: '[Good First Issue] Add more usage examples'
labels: ['good first issue', 'documentation', 'examples']
assignees: ''
---

## 📋 Description

The `examples/` directory currently has basic usage examples. We need more practical, real-world examples showing how to use `agent-loop-guard-js` in different scenarios.

## 🎯 Tasks

Choose one or more of these:

1. **Express.js Middleware Example** - Show how to integrate as Express middleware
2. **LangChain Integration** - Example with LangChain agents
3. **AutoGPT-style Agent** - Example protecting a multi-step autonomous agent
4. **CLI Tool Example** - Protect a CLI-based agent loop
5. **WebSocket Server Example** - Agent with real-time communication

## 📁 Where to Add

Add new files to the `examples/` directory:
```
examples/
├── basic-usage.ts          # Already exists
├── express-middleware.ts   # NEW - Express integration
├── langchain-agent.ts      # NEW - LangChain integration
├── autogpt-style.ts        # NEW - Multi-step agent
├── cli-agent.ts            # NEW - CLI tool
└── websocket-server.ts     # NEW - Real-time agent
```

## ✅ Requirements

- Each example should be a complete, runnable TypeScript file
- Include comments explaining the key parts
- Show how to configure the guard for the specific use case
- Add a brief README section in the example file header

## 🚀 How to Test

```bash
# From the repo root
npm run build
npx tsx examples/your-new-example.ts
```

## 📝 Notes

- This is a great first contribution - no deep library knowledge needed
- Focus on clarity and practicality
- Feel free to ask questions in the issue comments!

---

**Good First Issue** ✨ - Perfect for newcomers to the codebase