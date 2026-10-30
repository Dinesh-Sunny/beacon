---
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/__tests__/**"
  - "**/tests/**"
  - "e2e/**"
---
<!-- last-verified: 2026-10-03 -->
# Testing

- No unit tests. Write only these three kinds, and only where a real flow or boundary needs one:
  - E2E: full user flows in a headless browser (`agent-browser`), nothing mocked; safe to run against prod test accounts.
  - Integration: real DB, real APIs, across data/API boundaries where schemas drift.
  - Golden: real data examples as fixtures, checked as regressions for edge cases.
- Don't pad coverage. One test per meaningful flow or boundary beats many small ones.
- Python: pytest, files `python/<member>/tests/test_*.py`. Run one with `uv run pytest <path>`.
- JS/TS: Node's built-in runner (`node --test`, types stripped), files `src/**/*.test.ts`, wired as each package's `test` script.
- DB integration tests skip without `DATABASE_URL`; CI always provides one, so they never skip there.
- Names: "should <expected> when <condition>" (JS) / `test_<behavior>_when_<condition>` (Python).
- No mocks. Use real services, test accounts, and recorded real data instead.
- Bug fix → write a failing integration, E2E, or golden test first, then fix.
- No `.only` / `.skip` committed. No sleeps; await conditions.
