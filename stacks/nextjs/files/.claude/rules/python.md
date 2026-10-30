---
paths:
  - "python/**"
  - "**/*.py"
  - "pyproject.toml"
---
<!-- last-verified: 2026-10-03 -->
# Python (uv workspace)

- Manage everything with uv: `uv add --package <member> <dep>`, `uv run ...`. Never pip, venv, or poetry.
- New member: `uv init --lib python/<name>` (library) or `--app` (service). Name it `__NAME__-<name>`, import as `__PYNAME___<name>`.
- src layout: code in `python/<name>/src/__PYNAME___<name>/`, tests in `python/<name>/tests/test_*.py`.
- Cross-member dependency: `uv add --package <consumer> __NAME__-<member>`; uv writes `{ workspace = true }`.
- Shared tooling config lives only in the root `pyproject.toml` (ruff, mypy, pytest). Don't add per-member copies.
- Full type hints; `mypy --strict` must pass. Use `py.typed` in libraries.
- ruff owns lint and format (`pnpm lint:py`, `pnpm format`). Fix the warnings instead of adding `noqa`.
- `python/api` is a private sidecar: add endpoints only for Python-only needs; everything else belongs in Next.js.
- New endpoint: Pydantic models in `models.py`, a test in `python/api/tests/`, and the matching typed function in `apps/web/src/lib/python-api.ts`.
- Commit `uv.lock`; never edit it by hand.
