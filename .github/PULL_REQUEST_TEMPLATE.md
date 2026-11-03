name: Pull request
description: Contribute a change to agent-loop-guard-js
title: "[PR]: "
labels: ["needs review"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for contributing!

        Please make sure `npm run verify` passes locally before opening the PR.

  - type: textarea
    id: description
    attributes:
      label: What does this change?
    validations:
      required: true

  - type: dropdown
    id: type
    attributes:
      label: Type of change
      options:
        - Bug fix
        - New feature
        - Performance improvement
        - Documentation
        - Refactor / internal cleanup
        - Test coverage
        - Build or CI
    validations:
      required: true

  - type: textarea
    id: testing
    attributes:
      label: How was this tested?
      description: Tests, manual steps, or a reproduction.
    validations:
      required: true

  - type: checkboxes
    id: checks
    attributes:
      label: Checklist
      options:
        - label: `npm run verify` passes (typecheck, lint, test, build).
          required: true
        - label: I added or updated tests for this change.
          required: true
        - label: I did not add any runtime dependencies.
          required: true
        - label: I updated the documentation and CHANGELOG where relevant.
          required: false
