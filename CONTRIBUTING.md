# Contributing to Agent Loop Guard

Thank you for considering contributing to Agent Loop Guard! This document outlines the process for contributing to this project.

## 🌟 Quick Start for Contributors

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/your-username/agent-loop-guard.git`
3. **Install** dependencies: `npm install`
4. **Build** the project: `npm run build`
5. **Run tests**: `npm test`
6. **Create a branch** for your changes
7. **Make changes** and ensure all tests pass
8. **Submit a Pull Request**

## 🏷️ Issue Labels for New Contributors

We use these labels to help newcomers find suitable tasks:

| Label | Description |
|-------|-------------|
| `good first issue` | Perfect for first-time contributors |
| `documentation` | Documentation improvements |
| `examples` | Adding usage examples |
| `testing` | Test improvements and coverage |
| `help wanted` | Tasks where we need community help |
| `bug` | Something isn't working |

Look for issues tagged with **`good first issue`** to get started!

## 📁 Project Structure

```
agent-loop-guard/
├── src/
│   ├── index.ts              # Main exports
│   ├── guard.ts              # Core AgentLoopGuard class
│   ├── types.ts              # TypeScript interfaces
│   ├── detectors/            # Detection algorithms
│   │   ├── step-budget.ts
│   │   ├── time-budget.ts
│   │   ├── repetition.ts
│   │   ├── same-tool.ts
│   │   ├── loop-pattern.ts
│   │   └── canonicalize.ts   # Argument normalization
│   └── index.ts
├── tests/                    # Vitest test files
├── examples/                 # Usage examples
├── .github/
│   ├── workflows/ci.yml      # GitHub Actions CI
│   └── ISSUE_TEMPLATE/       # Issue templates
├── package.json
├── tsconfig.json
└── README.md
```

## 🛠️ Development Commands

```bash
# Install dependencies
npm install

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Testing
npm test              # Run tests once
npm run test:watch    # Watch mode
npm run coverage      # Coverage report

# Building
npm run build         # Production build (outputs to dist/)

# Release (maintainers only)
npm run release
```

## ✅ Pull Request Checklist

Before submitting a PR, ensure:

- [ ] All tests pass: `npm test`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Code follows existing style
- [ ] Documentation updated (if applicable)
- [ ] New tests added (for new features/bug fixes)
- [ ] Commit messages are clear and descriptive

## 📝 Code Style Guidelines

- **TypeScript**: Strict mode enabled - no `any` unless absolutely necessary
- **ESLint**: Follow the configured rules (`npm run lint`)
- **Naming**: Use descriptive names (`maxRepeatedCalls` not `mrc`)
- **Comments**: Document complex logic, especially in detectors
- **Tests**: Write tests for new functionality
- **Exports**: Only export public API from `src/index.ts`

## 🧪 Writing Tests

Tests use **Vitest**. Look at existing tests for patterns:

```typescript
// tests/detectors/repetition.test.ts
import { describe, it, expect } from 'vitest';
import { RepetitionDetector } from '../../src/detectors/repetition';

describe('RepetitionDetector', () => {
  it('should detect repeated calls with same arguments', () => {
    const detector = new RepetitionDetector({ maxRepeatedCalls: 3 });
    // ... test implementation
  });
});
```

## 📚 Adding Examples

Examples live in the `examples/` directory. Each should be:
- **Runnable**: `npx tsx examples/your-example.ts`
- **Self-contained**: No external dependencies beyond what's in package.json
- **Well-commented**: Explain the use case and key configurations

## 🐛 Reporting Bugs

Use the GitHub issue tracker. Include:
1. **Clear title** describing the problem
2. **Steps to reproduce** (minimal code example)
3. **Expected behavior**
4. **Actual behavior**
5. **Environment**: Node version, OS, package version

## 💡 Feature Requests

Open an issue with:
- **Use case**: Why is this needed?
- **Proposed API**: How should it work?
- **Alternatives considered**: Other approaches?

## 📄 License

By contributing to Agent Loop Guard, you agree that your contributions will be licensed under the **MIT License**.

## 🙋 Getting Help

- **GitHub Discussions**: For questions and ideas
- **Issues**: For bugs and feature requests
- **Discord/Slack**: (Add links if available)

## 🏆 Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- GitHub contributors graph

---

**First time contributing?** Welcome! 🎉 Look for issues labeled `good first issue` and don't hesitate to ask questions in the issue comments.