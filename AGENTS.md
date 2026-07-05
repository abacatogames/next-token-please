# AGENTS.md

## Summary

Next Token Please is a browser game where the player role-plays as a language model, completing an AI's answer one word at a time.

Two workspaces:
- **Frontend** (`/frontend`): TypeScript + Vite, vanilla DOM, no frameworks.
- **Backend** (`/backend`): Python 3.11 + FastAPI + Ollama. Generates rounds via a local LLM.

### Working pattern

* Read nearby source and tests first.
* Make the smallest correct change.
* Run relevant tests.
* Ensure to always commit your changes.
* Keep commit messages short, in imperative mood, and without prefixes (e.g. `Add user profile validation`).

### Phased Development Workflow

* When creating an implementation plan, break the work into small, independently deliverable phases. Each phase should result in a working, testable increment.
* Commit all completed changes at the end of every phase using a clear, descriptive commit message before moving on to the next phase.
* Before making changes, create a new branch only if you're currently on the default branch.

### Testing

* Add or update tests for non-trivial behaviour changes.
* Use a test-first approach whenever possible.
* Frontend tests live alongside source (`*.test.ts`) and use `bun:test`.
* Backend tests live in `backend/tests/` and use `pytest`.

### Comments

* Real programmers (and agents) don't use comments. The code should be obvious.

### Naming

* Use clear, consistent, descriptive names; avoid unnecessary abbreviations unless they are widely understood.

### Commands

#### Frontend (run from `/frontend`)

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

#### Backend (run from `/backend`)

```bash
# Development server
uvicorn app.main:app --reload --port 8000

# Run tests
pytest

# Lint
ruff check
```

#### Full Docker stack (run from repo root)

```bash
docker compose up --build
```
