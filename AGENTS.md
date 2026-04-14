# AGENTS.md

## Summary

Next Token Please is a browser game where the player role-plays as a language model, completing an AI's answer one word at a time. Stack: TypeScript + Vite, no frameworks.

### Working pattern

* Read nearby source and tests first.
* Make the smallest correct change.
* Run relevant tests.
* Ensure to always commit your changes.

### Testing

* Add or update tests for non-trivial behaviour changes.
* Use a test-first approach whenever possible.
* Tests live alongside source (`*.test.ts`) and use `bun:test`.

### Comments

* Real programmers (and agents) don't use comments. The code should be obvious.

### Naming

* Use clear, consistent, descriptive names; avoid unnecessary abbreviations unless they are widely understood.

### Commands

```bash
# Development server
bun run dev

# Build for production
bun run build

# Run tests
bun test

# Type check
bun run typecheck

# Lint
bun run lint
```
