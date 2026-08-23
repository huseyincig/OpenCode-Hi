# Verification

OpenCode-Hi separates static checks, deterministic tests, integration behavior, exact-host acceptance, and real publication evidence. A lower evidence tier never certifies a higher-tier claim.

## Local gates

For active development, run the product/source/runtime/documentation gate:

```sh
npm run check:product
```

The evidence layer is a separate exact-source certification gate. Determine readiness first:

```sh
python scripts/evidence-validation-readiness.py
```

When that command reports `evidence_ready=true`, run:

```sh
npm run check:evidence
```

`npm run check` is the strict combined product + evidence gate for an evidence-ready candidate. It is deliberately not the normal material-development checkpoint: after source changes, exact-source external CI evidence is stale until the corresponding Release Readiness run exists. CI follows the same split and records evidence certification as pending rather than treating a newer product commit as a failed T3/T4 claim.

Run Python product acceptance when the changed boundary is covered there:

```sh
npm run test:python:product
```

Use focused tests while editing; run `check:product` before a coherent checkpoint when shipped behavior, generated projections, or public documentation changed.

## Evidence tiers

- **T0** — schema/static/lint/documentation parity.
- **T1** — deterministic unit/contract tests.
- **T2** — integration/runtime wiring.
- **T3** — exact-version real-host acceptance.
- **T4** — real external release/publication verification.

Runtime health or API presence is not T3 by itself. Package metadata is not T4 by itself.

## Upstream OpenCode drift

`npm run host:check-update` is a cheap compatibility-discovery gate, not a T3 certificate. It compares the exact package target with the three stable OpenCode registry identities and, when a newer stable version exists, classifies the exact upstream tag-to-tag source delta through `data/opencode-host-compatibility-policy.json`.

The classifier maps known provider/model/session/PTY/workspace/question-permission/SDK-plugin source surfaces to the smallest affected verification boundary. Metadata-only changes do not invalidate unrelated T3 evidence. Unknown changes inside critical OpenCode source roots fail closed to manual review. A successful observation never changes the package target and never promotes support; target migration and the selected fresh-consumer/T3 evidence remain explicit engineering actions.

## Documentation parity

Public documentation is intentionally small. CI validates current-document links, generated configuration/host projections, current release truth, and stale publication/capability language. Historical engineering notes are not build inputs and cannot own current behavior.

## Current certification

Machine-readable release, cross-platform, exact-host, publication, and final-certification evidence lives under `data/validation/`. Human-facing docs summarize those facts but do not duplicate receipt ledgers.
