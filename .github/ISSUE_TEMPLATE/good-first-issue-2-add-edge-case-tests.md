---
name: Good First Issue - Add More Tests for Edge Cases
about: Improve test coverage with edge case tests
title: '[Good First Issue] Add edge case tests'
labels: ['good first issue', 'testing', 'coverage']
assignees: ''
---

## 📋 Description

The test suite covers the main functionality, but we need more edge case tests to ensure robustness. This is a great way to learn the codebase while contributing!

## 🎯 Tasks

Choose one or more of these edge cases to test:

### 1. **Unicode & Special Characters in Tool Arguments**
```typescript
// Test that canonicalization handles Unicode properly
const step = { tool: 'test', args: { emoji: '🎉', chinese: '你好', special: '🚀💯' } };
```

### 2. **Deeply Nested Objects**
```typescript
// Test canonicalization with deeply nested structures
const args = { a: { b: { c: { d: { e: 'deep' } } } } };
```

### 3. **Circular References in Arguments**
```typescript
// Test that circular refs don't crash canonicalization
const obj: any = { a: 1 };
obj.self = obj;
```

### 4. **Large Argument Objects (Performance)**
```typescript
// Test with very large argument objects
const largeArgs = { data: 'x'.repeat(100000) };
```

### 5. **Rapid Sequential Calls (Timing Edge Cases)**
```typescript
// Test time budget with rapid calls
// Use setTimeout to test duration boundaries
```

### 5. **Zero-Value Configurations**
```typescript
// Test with maxSteps: 0, maxDuration: 0 (unlimited)
const guard = new AgentLoopGuard({ maxSteps: 0, maxDuration: 0 });
```

## 📁 Where to Add

Add tests to:
```
tests/
├── edge-cases/
│   ├── unicode-arguments.test.ts     # NEW
│   ├── deep-nesting.test.ts          # NEW
│   ├── circular-refs.test.ts         # NEW
│   ├── large-arguments.test.ts       # NEW
│   ├── timing-boundaries.test.ts     # NEW
│   └── zero-config.test.ts           # NEW
└── existing.test.ts                  # Keep existing
```

## ✅ Requirements

- Each test file should focus on one edge case
- Use `vitest` syntax (already configured)
- Include both positive and negative test cases
- Aim for descriptive test names: `should handle unicode in arguments without throwing`

## 🚀 How to Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run coverage

# Run specific test file
npx vitest run tests/edge-cases/unicode-arguments.test.ts
```

## 📝 Notes

- Look at existing tests in `tests/` for patterns
- The canonicalization logic is in `src/detectors/` - check `canonicalize.ts`
- This helps you understand the core detection algorithms!
- Ask questions if anything is unclear

---

**Good First Issue** ✨ - Perfect for learning the codebase through testing