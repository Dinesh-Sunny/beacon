# python/

uv workspace members (Python libraries and services). Each member needs its own `pyproject.toml`.
Add a member: `uv init --lib python/<name>` (or `--app` for a service). Depend on another member with
`uv add --package <consumer> <member>`; uv wires `{ workspace = true }` automatically.
