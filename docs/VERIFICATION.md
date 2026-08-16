# Verification

OpenCode-Hi separates static checks, deterministic tests, integration behavior, exact-host acceptance, and real publication evidence. A lower evidence tier never certifies a higher-tier claim.

## Local gates

Run the combined source/runtime/documentation gate:

```sh
npm run check
```

Run Python acceptance when the changed boundary is covered there:

```sh
python -m pytest -q tests/test_hi.py
```

Use focused tests while editing; run the broader gate before a coherent checkpoint when shipped behavior, generated projections, or public documentation changed.

## Evidence tiers

- **T0** — schema/static/lint/documentation parity.
- **T1** — deterministic unit/contract tests.
- **T2** — integration/runtime wiring.
- **T3** — exact-version real-host acceptance.
- **T4** — real external release/publication verification.

Runtime health or API presence is not T3 by itself. Package metadata is not T4 by itself.

## Documentation parity

Public documentation is intentionally small. CI validates current-document links, generated configuration/host projections, current release truth, and stale publication/capability language. Historical engineering notes are not build inputs and cannot own current behavior.

## Current certification

Machine-readable release, cross-platform, exact-host, publication, and final-certification evidence lives under `data/validation/`. Human-facing docs summarize those facts but do not duplicate receipt ledgers.
